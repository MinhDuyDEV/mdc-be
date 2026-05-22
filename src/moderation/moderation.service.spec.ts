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
      message: { findUnique: jest.fn() },
      profile: { findUnique: jest.fn() },
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
});
