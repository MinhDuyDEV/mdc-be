import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplyMode,
  CompanyRole,
  EmploymentType,
  JobStatus,
  WorkplaceType,
} from '@prisma/client';
import type { EntitlementsService } from '../billing/entitlements/entitlements.service';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { IdempotencyService } from '../outbox/idempotency.service';
import { JobsService } from './jobs.service';

interface MockPrisma {
  job: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  companyMember: { findUnique: jest.Mock };
  recruiterSeat: { findFirst: jest.Mock };
  savedJob: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  auditLog: { create: jest.Mock };
  jobSkill: { deleteMany: jest.Mock; createMany: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    job: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    companyMember: { findUnique: jest.fn() },
    recruiterSeat: { findFirst: jest.fn() },
    savedJob: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    jobSkill: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (cb: (tx: MockPrisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

function buildJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    companyId: 'company-1',
    title: 'Senior Engineer',
    description: 'Build amazing things.',
    applyMode: ApplyMode.INTERNAL,
    applyUrl: null,
    status: JobStatus.DRAFT,
    employmentType: EmploymentType.FULL_TIME,
    workplaceType: WorkplaceType.REMOTE,
    location: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    publishedAt: null,
    closedAt: null,
    deletedAt: null,
    searchVector: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    skills: [],
    ...overrides,
  };
}

const validCreateDto = {
  companyId: 'company-1',
  title: 'Senior Engineer',
  description: 'Build amazing things.',
  applyMode: ApplyMode.INTERNAL,
  employmentType: EmploymentType.FULL_TIME,
  workplaceType: WorkplaceType.REMOTE,
};

describe('JobsService', () => {
  let prisma: MockPrisma;
  let outbox: { emit: jest.Mock };
  let idempotency: { claim: jest.Mock };
  let entitlements: { consumeCredit: jest.Mock };
  let service: JobsService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    outbox = { emit: jest.fn().mockResolvedValue(undefined) };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    entitlements = { consumeCredit: jest.fn().mockResolvedValue(undefined) };
    service = new JobsService(
      prisma as unknown as PrismaService,
      outbox,
      idempotency as unknown as IdempotencyService,
      entitlements as unknown as EntitlementsService,
    );
  });

  describe('createJob — applyMode mutual exclusivity', () => {
    it('rejects INTERNAL + applyUrl set with INTERNAL_NO_APPLY_URL', async () => {
      await expect(
        service.createJob('user-1', {
          ...validCreateDto,
          applyMode: ApplyMode.INTERNAL,
          applyUrl: 'https://acme.com/apply',
        }),
      ).rejects.toThrow(new BadRequestException('INTERNAL_NO_APPLY_URL'));
    });

    it('rejects EXTERNAL + no applyUrl with EXTERNAL_REQUIRES_APPLY_URL', async () => {
      await expect(
        service.createJob('user-1', {
          ...validCreateDto,
          applyMode: ApplyMode.EXTERNAL,
        }),
      ).rejects.toThrow(new BadRequestException('EXTERNAL_REQUIRES_APPLY_URL'));
    });

    it('rejects HYBRID + no applyUrl with HYBRID_REQUIRES_APPLY_URL', async () => {
      await expect(
        service.createJob('user-1', {
          ...validCreateDto,
          applyMode: ApplyMode.HYBRID,
        }),
      ).rejects.toThrow(new BadRequestException('HYBRID_REQUIRES_APPLY_URL'));
    });
  });

  describe('createJob — happy path', () => {
    it('creates job, audits, emits JobCreated', async () => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.OWNER,
        status: 'active',
      });
      prisma.job.create.mockResolvedValue(buildJobRow());

      const result = await service.createJob('user-1', validCreateDto);

      expect(result.id).toBe('job-1');
      expect(prisma.job.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'job.create' }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'JobCreated',
          aggregateType: 'Job',
          aggregateId: 'job-1',
        }),
      );
    });

    it('rejects when caller is not a company member', async () => {
      prisma.companyMember.findUnique.mockResolvedValue(null);

      await expect(service.createJob('user-1', validCreateDto)).rejects.toThrow(
        new ForbiddenException('NOT_COMPANY_MEMBER'),
      );
    });

    it('allows MEMBER role when an active RecruiterSeat exists', async () => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.MEMBER,
        status: 'active',
      });
      prisma.recruiterSeat.findFirst.mockResolvedValue({ id: 'seat-1' });
      prisma.job.create.mockResolvedValue(buildJobRow());

      const result = await service.createJob('user-1', validCreateDto);
      expect(result.id).toBe('job-1');
    });

    it('rejects MEMBER role without a RecruiterSeat', async () => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.MEMBER,
        status: 'active',
      });
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);

      await expect(service.createJob('user-1', validCreateDto)).rejects.toThrow(
        new ForbiddenException('INSUFFICIENT_COMPANY_ROLE'),
      );
    });
  });

  describe('updateJob — mutual exclusivity over partial patch', () => {
    it('rejects when patch sets applyMode=INTERNAL while existing applyUrl is non-null', async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({
          applyMode: ApplyMode.EXTERNAL,
          applyUrl: 'https://acme.com/apply',
        }),
      );
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.OWNER,
        status: 'active',
      });

      await expect(
        service.updateJob('user-1', 'job-1', {
          applyMode: ApplyMode.INTERNAL,
        }),
      ).rejects.toThrow(new BadRequestException('INTERNAL_NO_APPLY_URL'));
    });

    it("treats omitted applyUrl as 'no change' rather than 'set to undefined'", async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({
          applyMode: ApplyMode.EXTERNAL,
          applyUrl: 'https://acme.com/apply',
        }),
      );
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.OWNER,
        status: 'active',
      });
      prisma.job.update.mockResolvedValue(
        buildJobRow({
          applyMode: ApplyMode.EXTERNAL,
          applyUrl: 'https://acme.com/apply',
        }),
      );

      await expect(
        service.updateJob('user-1', 'job-1', {}),
      ).resolves.toBeDefined();
    });
  });

  describe('publishJob', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.OWNER,
        status: 'active',
      });
    });

    it('DRAFT → PUBLISHED works', async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({ status: JobStatus.DRAFT }),
      );
      prisma.job.update.mockResolvedValue(
        buildJobRow({ status: JobStatus.PUBLISHED, publishedAt: new Date() }),
      );

      const result = await service.publishJob('user-1', 'job-1');
      expect(result.status).toBe(JobStatus.PUBLISHED);
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'JobPublished' }),
      );
    });

    it('rejects PUBLISHED → PUBLISHED with INVALID_STATUS_TRANSITION', async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({ status: JobStatus.PUBLISHED }),
      );
      await expect(service.publishJob('user-1', 'job-1')).rejects.toThrow(
        new BadRequestException('INVALID_STATUS_TRANSITION'),
      );
    });
  });

  describe('closeJob', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.OWNER,
        status: 'active',
      });
    });

    it('PUBLISHED → CLOSED works', async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({ status: JobStatus.PUBLISHED }),
      );
      prisma.job.update.mockResolvedValue(
        buildJobRow({ status: JobStatus.CLOSED, closedAt: new Date() }),
      );

      const result = await service.closeJob('user-1', 'job-1');
      expect(result.status).toBe(JobStatus.CLOSED);
    });

    it('rejects CLOSED → CLOSED with INVALID_STATUS_TRANSITION', async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({ status: JobStatus.CLOSED }),
      );
      await expect(service.closeJob('user-1', 'job-1')).rejects.toThrow(
        new BadRequestException('INVALID_STATUS_TRANSITION'),
      );
    });
  });

  describe('deleteJob', () => {
    it('soft-deletes and emits JobDeleted', async () => {
      prisma.job.findFirst.mockResolvedValue(
        buildJobRow({ status: JobStatus.PUBLISHED }),
      );
      prisma.companyMember.findUnique.mockResolvedValue({
        role: CompanyRole.OWNER,
        status: 'active',
      });
      prisma.job.update.mockResolvedValue(
        buildJobRow({ status: JobStatus.DELETED }),
      );

      await service.deleteJob('user-1', 'job-1');

      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: JobStatus.DELETED }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'JobDeleted' }),
      );
    });
  });

  describe('saveJob', () => {
    it('is idempotent — returns existing active row when called twice', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.PUBLISHED,
      });
      const existing = { id: 'saved-1', userId: 'user-1', jobId: 'job-1' };
      prisma.savedJob.findFirst.mockResolvedValue(existing);

      const result = await service.saveJob('user-1', 'job-1');
      expect(result).toBe(existing);
      expect(idempotency.claim).toHaveBeenCalledWith(
        'SavedJob:save',
        'user-1:job-1',
      );
      expect(prisma.savedJob.create).not.toHaveBeenCalled();
    });

    it('rejects when target job is not PUBLISHED', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.DRAFT,
      });
      await expect(service.saveJob('user-1', 'job-1')).rejects.toThrow(
        new NotFoundException('JOB_NOT_FOUND'),
      );
    });
  });

  describe('unsaveJob', () => {
    it('sets deletedAt on the active SavedJob row', async () => {
      const existing = { id: 'saved-1', userId: 'user-1', jobId: 'job-1' };
      prisma.savedJob.findFirst.mockResolvedValue(existing);

      await service.unsaveJob('user-1', 'job-1');

      expect(prisma.savedJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'saved-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('is idempotent — no-op when no active SavedJob exists', async () => {
      prisma.savedJob.findFirst.mockResolvedValue(null);
      await expect(
        service.unsaveJob('user-1', 'job-1'),
      ).resolves.toBeUndefined();
      expect(prisma.savedJob.update).not.toHaveBeenCalled();
    });
  });

  describe('recordExternalApplyClick', () => {
    it('rejects INTERNAL apply mode with INTERNAL_ONLY_NO_EXTERNAL_APPLY', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        applyMode: ApplyMode.INTERNAL,
        companyId: 'company-1',
      });
      await expect(service.recordExternalApplyClick('job-1')).rejects.toThrow(
        new BadRequestException('INTERNAL_ONLY_NO_EXTERNAL_APPLY'),
      );
    });

    it('emits ExternalApplyClicked for EXTERNAL job (anonymous user)', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        applyMode: ApplyMode.EXTERNAL,
        companyId: 'company-1',
      });

      await service.recordExternalApplyClick('job-1');

      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'ExternalApplyClicked',
          payload: expect.objectContaining({
            jobId: 'job-1',
            userId: null,
          }),
        }),
      );
    });
  });

  describe('listJobs', () => {
    it('forces PUBLISHED filter for anonymous callers', async () => {
      prisma.job.findMany.mockResolvedValue([]);

      await service.listJobs({
        limit: 20,
        status: JobStatus.DRAFT,
      });

      const call = prisma.job.findMany.mock.calls[0][0];
      const baseWhere = (call.where as { AND: Array<{ status: JobStatus }> })
        .AND[0];
      expect(baseWhere.status).toBe(JobStatus.PUBLISHED);
    });
  });
});
