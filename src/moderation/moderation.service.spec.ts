import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReportCategory, ReportEntityType } from '@prisma/client';
import { ModerationService } from './moderation.service';
import type { ModerationPolicyService } from './moderation-policy.service';

describe('ModerationService', () => {
  let service: ModerationService;
  let prisma: any;
  let outbox: { emit: jest.Mock };
  let policy: { validateTargetExists: jest.Mock };

  beforeEach(() => {
    prisma = {
      report: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      moderationAction: { create: jest.fn() },
      post: { update: jest.fn(), findUnique: jest.fn() },
      comment: { findUnique: jest.fn() },
      message: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      profile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      company: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    outbox = { emit: jest.fn().mockResolvedValue(undefined) };
    policy = { validateTargetExists: jest.fn() };
    service = new ModerationService(
      prisma,
      outbox,
      policy as unknown as ModerationPolicyService,
    );
  });

  describe('createReport', () => {
    it('creates report when target exists', async () => {
      policy.validateTargetExists.mockResolvedValue(true);
      prisma.report.findFirst.mockResolvedValue(null);
      prisma.report.create.mockResolvedValue({
        id: 'report-1',
        status: 'PENDING',
      });

      const result = await service.createReport(
        {
          targetEntity: ReportEntityType.POST,
          targetId: 'post-1',
          category: ReportCategory.SPAM,
        },
        'user-1',
      );

      expect(result.id).toBe('report-1');
      expect(policy.validateTargetExists).toHaveBeenCalledWith(
        'POST',
        'post-1',
      );
    });

    it('throws NotFoundException when target does not exist', async () => {
      policy.validateTargetExists.mockResolvedValue(false);
      await expect(
        service.createReport(
          {
            targetEntity: ReportEntityType.POST,
            targetId: 'post-1',
            category: ReportCategory.SPAM,
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when duplicate active report exists', async () => {
      policy.validateTargetExists.mockResolvedValue(true);
      prisma.report.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.createReport(
          {
            targetEntity: ReportEntityType.POST,
            targetId: 'post-1',
            category: ReportCategory.SPAM,
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('claimReport', () => {
    it('claims report atomically with FOR UPDATE SKIP LOCKED', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'report-1' }]);
      prisma.report.update.mockResolvedValue({
        id: 'report-1',
        status: 'UNDER_REVIEW',
      });

      const result = await service.claimReport('report-1', 'mod-1');

      expect(result.status).toBe('UNDER_REVIEW');
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('applyContentRemoval for PROFILE / COMPANY / MESSAGE', () => {
    it('soft-deletes PROFILE and emits ProfileRemoved', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        targetEntity: ReportEntityType.PROFILE,
        targetId: 'profile-1',
      });
      prisma.profile.findUnique.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        deletedAt: null,
      });

      await service.applyModerationAction(
        {
          reportId: 'report-1',
          actionType: 'REMOVE_CONTENT',
          targetEntity: ReportEntityType.PROFILE,
          targetId: 'profile-1',
          reason: 'Inappropriate',
        },
        'mod-1',
      );

      expect(prisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'ProfileRemoved',
          payload: expect.objectContaining({
            profileId: 'profile-1',
            userId: 'user-1',
          }),
        }),
      );
      expect(prisma.moderationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'REMOVE_CONTENT',
          }),
        }),
      );
      expect(prisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({
            status: 'RESOLVED_ACTIONED',
          }),
        }),
      );
    });

    it('soft-deletes COMPANY and emits CompanyRemoved', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-2',
        targetEntity: ReportEntityType.COMPANY,
        targetId: 'company-1',
      });
      prisma.company.findUnique.mockResolvedValue({
        id: 'company-1',
        deletedAt: null,
      });

      await service.applyModerationAction(
        {
          reportId: 'report-2',
          actionType: 'REMOVE_CONTENT',
          targetEntity: ReportEntityType.COMPANY,
          targetId: 'company-1',
          reason: 'Spam',
        },
        'mod-1',
      );

      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'company-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'CompanyRemoved',
          payload: expect.objectContaining({ companyId: 'company-1' }),
        }),
      );
      expect(prisma.moderationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'REMOVE_CONTENT',
          }),
        }),
      );
      expect(prisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-2' },
          data: expect.objectContaining({
            status: 'RESOLVED_ACTIONED',
          }),
        }),
      );
    });

    it('soft-deletes MESSAGE and emits MessageRemoved', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-3',
        targetEntity: ReportEntityType.MESSAGE,
        targetId: 'message-1',
      });
      prisma.message.findUnique.mockResolvedValue({
        id: 'message-1',
        conversationId: 'conv-1',
        deletedAt: null,
      });

      await service.applyModerationAction(
        {
          reportId: 'report-3',
          actionType: 'REMOVE_CONTENT',
          targetEntity: ReportEntityType.MESSAGE,
          targetId: 'message-1',
          reason: 'Harassment',
        },
        'mod-1',
      );

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'message-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'MessageRemoved',
          payload: expect.objectContaining({
            messageId: 'message-1',
            conversationId: 'conv-1',
          }),
        }),
      );
      expect(prisma.moderationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'REMOVE_CONTENT',
          }),
        }),
      );
      expect(prisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-3' },
          data: expect.objectContaining({
            status: 'RESOLVED_ACTIONED',
          }),
        }),
      );
    });

    it('throws NotFoundException when PROFILE does not exist', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        targetEntity: ReportEntityType.PROFILE,
        targetId: 'missing',
      });
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(
        service.applyModerationAction(
          {
            reportId: 'report-1',
            actionType: 'REMOVE_CONTENT',
            targetEntity: ReportEntityType.PROFILE,
            targetId: 'missing',
            reason: 'x',
          },
          'mod-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
