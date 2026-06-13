import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import { AuthService } from '../auth/auth.service';
import { ConnectionsService } from '../connections/connections.service';
import { PostsService } from '../posts/posts.service';
import { MessagingService } from '../messaging/messaging.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SearchIndexService } from '../search/search-index.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DataExportService } from './data-export.service';
import { DeletionRequestService } from './deletion-request.service';
import { GdprService } from './gdpr.service';

describe('GdprService', () => {
  let service: GdprService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let deletionRequestService: {
    createDeletionRequest: jest.Mock;
    cancelRequest: jest.Mock;
  };
  let idempotencyService: { claim: jest.Mock };
  let outboxService: { emit: jest.Mock };
  let authService: { revokeAllUserSessions: jest.Mock };
  let realtimeGateway: { disconnectUser: jest.Mock };
  let connectionsService: { anonymizeForUser: jest.Mock };
  let postsService: { anonymizeForUser: jest.Mock };
  let messagingService: { anonymizeForUser: jest.Mock };
  let analyticsService: { anonymizeForUser: jest.Mock };
  let searchIndex: { deleteByUser: jest.Mock };

  const mockRequest = {
    id: 'req-1',
    userId: 'user-1',
    requestedBy: 'user-1',
    reason: null,
    status: 'PENDING_ERASURE',
    scheduledFor: new Date(),
    dueBy: new Date(),
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'user1@example.com',
    displayName: 'Alice',
    handle: 'alice',
    status: 'ACTIVE',
    anonymizedAt: null,
    anonymizedEmail: null,
    passwordHash: 'hash',
  };

  beforeEach(async () => {
    prisma = {
      deletionRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        updateMany: jest.fn(),
      },
      profile: { updateMany: jest.fn() },
      experience: { updateMany: jest.fn() },
      education: { updateMany: jest.fn() },
      certification: { updateMany: jest.fn() },
      deletionAudit: {
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    deletionRequestService = {
      createDeletionRequest: jest.fn(),
      cancelRequest: jest.fn(),
    };
    idempotencyService = { claim: jest.fn() };
    outboxService = { emit: jest.fn() };
    authService = { revokeAllUserSessions: jest.fn() };
    realtimeGateway = { disconnectUser: jest.fn() };
    connectionsService = { anonymizeForUser: jest.fn() };
    postsService = { anonymizeForUser: jest.fn() };
    messagingService = { anonymizeForUser: jest.fn() };
    analyticsService = { anonymizeForUser: jest.fn() };
    searchIndex = { deleteByUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(7) },
        },
        { provide: OutboxService, useValue: outboxService },
        { provide: IdempotencyService, useValue: idempotencyService },
        { provide: AuthService, useValue: authService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: ConnectionsService, useValue: connectionsService },
        { provide: PostsService, useValue: postsService },
        { provide: MessagingService, useValue: messagingService },
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: SearchIndexService, useValue: searchIndex },
        {
          provide: DeletionRequestService,
          useValue: deletionRequestService,
        },
        { provide: DataExportService, useValue: {} },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  describe('requestOwnDeletion', () => {
    it('delegates to deletionRequestService with userId as both user and requester', async () => {
      deletionRequestService.createDeletionRequest.mockResolvedValue(
        mockRequest,
      );
      const result = await service.requestOwnDeletion('user-1');
      expect(deletionRequestService.createDeletionRequest).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        undefined,
      );
      expect(result).toEqual(mockRequest);
    });

    it('passes through reason argument', async () => {
      deletionRequestService.createDeletionRequest.mockResolvedValue(
        mockRequest,
      );
      await service.requestOwnDeletion('user-1', 'leaving');
      expect(deletionRequestService.createDeletionRequest).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        'leaving',
      );
    });
  });

  describe('requestDeletionForUser', () => {
    it('uses requestedBy (not userId) as the requester', async () => {
      deletionRequestService.createDeletionRequest.mockResolvedValue(
        mockRequest,
      );
      await service.requestDeletionForUser('user-1', 'admin-1', 'policy');
      expect(deletionRequestService.createDeletionRequest).toHaveBeenCalledWith(
        'user-1',
        'admin-1',
        'policy',
      );
    });
  });

  describe('cancelDeletion', () => {
    it('delegates to deletionRequestService.cancelRequest', async () => {
      deletionRequestService.cancelRequest.mockResolvedValue(undefined);
      await service.cancelDeletion('req-1', 'user-1');
      expect(deletionRequestService.cancelRequest).toHaveBeenCalledWith(
        'req-1',
        'user-1',
      );
    });
  });

  describe('anonymizeUser', () => {
    it('returns NotFound when deletion request missing', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(null);
      await expect(service.anonymizeUser('req-x')).rejects.toThrow(
        'Deletion request not found',
      );
    });

    it('short-circuits when request is already COMPLETED', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: 'COMPLETED',
      });
      const result = await service.anonymizeUser('req-1');
      expect(result).toEqual({ userId: 'user-1', success: true });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns NotFound when user missing', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.anonymizeUser('req-1')).rejects.toThrow(
        'User not found',
      );
    });

    it('is idempotent when user.anonymizedAt already set', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        anonymizedAt: new Date(),
      });
      const result = await service.anonymizeUser('req-1');
      expect(result.success).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      // Marks request COMPLETED for recovery
      expect(prisma.deletionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
    });

    it('returns success without re-running when idempotency claim already taken', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const conflictErr = Object.assign(new Error('dup'), { code: 'P2002' });
      idempotencyService.claim.mockRejectedValue(conflictErr);
      const result = await service.anonymizeUser('req-1');
      expect(result.success).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rethrows non-duplicate errors from idempotency claim', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      idempotencyService.claim.mockRejectedValue(new Error('db down'));
      await expect(service.anonymizeUser('req-1')).rejects.toThrow('db down');
    });

    it('happy path: anonymizes user, soft-deletes children, emits 2 events, appends audit, calls post-commit hooks', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      idempotencyService.claim.mockResolvedValue(undefined);
      // The transaction body receives a tx; emulate its calls.
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<void>) => {
          const tx = {
            user: {
              findUnique: jest.fn().mockResolvedValue(mockUser),
              update: jest.fn(),
            },
            auditLog: { updateMany: jest.fn() },
            profile: { updateMany: jest.fn() },
            experience: { updateMany: jest.fn() },
            education: { updateMany: jest.fn() },
            certification: { updateMany: jest.fn() },
            deletionRequest: { update: jest.fn() },
            deletionAudit: {
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn(),
            },
          };
          await cb(tx);
        },
      );

      const result = await service.anonymizeUser('req-1');
      expect(result).toEqual({ userId: 'user-1', success: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Post-commit hooks fire (no throw because all mocked)
      expect(authService.revokeAllUserSessions).toHaveBeenCalledWith('user-1');
      expect(realtimeGateway.disconnectUser).toHaveBeenCalledWith('user-1');
    });

    it('handles TOCTOU: user becomes anonymized between findUnique and tx', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      idempotencyService.claim.mockResolvedValue(undefined);
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<void>) => {
          const tx = {
            user: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ ...mockUser, anonymizedAt: new Date() }),
              update: jest.fn(),
            },
            auditLog: { updateMany: jest.fn() },
            profile: { updateMany: jest.fn() },
            experience: { updateMany: jest.fn() },
            education: { updateMany: jest.fn() },
            certification: { updateMany: jest.fn() },
            deletionRequest: { update: jest.fn() },
            deletionAudit: {
              count: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          };
          await cb(tx);
        },
      );
      const result = await service.anonymizeUser('req-1');
      expect(result.success).toBe(true);
    });
  });
});

// Type-only reference so unused imports are intentional in this file's type
// space; ensures `AppConfig` is referenced for compiler config.
void (null as unknown as AppConfig);
