import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let deadLetter: any;
  let outbox: any;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      company: { findMany: jest.fn(), update: jest.fn() },
      companyVerification: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      job: { findMany: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      outboxDeadLetter: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    deadLetter = { replay: jest.fn() };
    outbox = { emit: jest.fn() };
    service = new AdminService(prisma, deadLetter, outbox);
  });

  describe('listUsers', () => {
    it('returns paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'test@example.com' },
      ]);
      const result = await service.listUsers({});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updateUserStatus', () => {
    it('suspends user and revokes sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.SUSPENDED,
      });
      await service.updateUserStatus(
        'user-1',
        { status: UserStatus.SUSPENDED, reason: 'Spam' },
        'admin-1',
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws BadRequestException for invalid transition DELETED → ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.DELETED,
      });
      await expect(
        service.updateUserStatus(
          'user-1',
          { status: UserStatus.ACTIVE, reason: 'Restore' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(outbox.emit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUserStatus(
          'missing',
          { status: UserStatus.SUSPENDED, reason: 'x' },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('short-circuits on no-op (same status) and emits no event', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      });
      await service.updateUserStatus(
        'user-1',
        { status: UserStatus.ACTIVE, reason: 're-click' },
        'admin-1',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(outbox.emit).not.toHaveBeenCalled();
    });

    it('emits UserStatusChanged with previousStatus', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      });
      await service.updateUserStatus(
        'user-1',
        { status: UserStatus.SUSPENDED, reason: 'Spam' },
        'admin-1',
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'UserStatusChanged',
          payload: expect.objectContaining({
            userId: 'user-1',
            previousStatus: UserStatus.ACTIVE,
            newStatus: UserStatus.SUSPENDED,
            changedBy: 'admin-1',
          }),
        }),
      );
    });

    it('captures previousStatus in audit log metadata', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      });
      await service.updateUserStatus(
        'user-1',
        { status: UserStatus.SUSPENDED, reason: 'Spam' },
        'admin-1',
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            previousStatus: UserStatus.ACTIVE,
            newStatus: UserStatus.SUSPENDED,
          }),
        }),
      });
    });
  });

  describe('dead letters', () => {
    it('lists dead letters with pagination metadata', async () => {
      prisma.outboxDeadLetter.findMany.mockResolvedValue([
        { id: 'dl-1', eventType: 'UserRegistered' },
      ]);

      const result = await service.listDeadLetters({
        eventType: 'UserRegistered',
      });

      expect(prisma.outboxDeadLetter.findMany).toHaveBeenCalledWith({
        where: { eventType: 'UserRegistered' },
        take: 51,
        orderBy: { failedAt: 'desc' },
      });
      expect(result).toEqual({
        data: [{ id: 'dl-1', eventType: 'UserRegistered' }],
        meta: { hasNextPage: false, endCursor: 'dl-1' },
      });
    });

    it('replays dead letter and writes audit log in the same transaction', async () => {
      await service.replayDeadLetter('dl-1', 'admin-1');

      expect(deadLetter.replay).toHaveBeenCalledWith(prisma, 'dl-1');
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 'admin-1',
          action: 'admin.outbox.dead_letter.replay',
          entityType: 'OutboxDeadLetter',
          entityId: 'dl-1',
          metadata: {},
        },
      });
    });
  });
});
