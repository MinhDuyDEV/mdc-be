import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, JobStatus } from '@prisma/client';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { IdempotencyService } from '../outbox/idempotency.service';
import { ApplicationsService } from './applications.service';

interface MockPrisma {
  job: { findFirst: jest.Mock };
  mediaAsset: { findUnique: jest.Mock };
  application: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  applicationStatusEvent: { create: jest.Mock };
  applicationNote: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  companyMember: { findUnique: jest.Mock };
  recruiterSeat: { findFirst: jest.Mock };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    job: { findFirst: jest.fn() },
    mediaAsset: { findUnique: jest.fn() },
    application: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    applicationStatusEvent: { create: jest.fn() },
    applicationNote: { create: jest.fn(), findMany: jest.fn() },
    companyMember: { findUnique: jest.fn() },
    recruiterSeat: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (cb: (tx: MockPrisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

function buildAppRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    jobId: 'job-1',
    userId: 'candidate-1',
    status: ApplicationStatus.SUBMITTED,
    coverLetter: null,
    resumeMediaAssetId: null,
    idempotencyKey: null,
    submittedAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    withdrawnAt: null,
    answers: [],
    attachments: [],
    statusEvents: [],
    notes: [],
    job: { companyId: 'company-1' },
    ...overrides,
  };
}

describe('ApplicationsService', () => {
  let prisma: MockPrisma;
  let outbox: { emit: jest.Mock };
  let idempotency: { claim: jest.Mock };
  let service: ApplicationsService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    outbox = { emit: jest.fn().mockResolvedValue(undefined) };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    service = new ApplicationsService(
      prisma as unknown as PrismaService,
      outbox,
      idempotency as unknown as IdempotencyService,
    );
  });

  describe('submitApplication', () => {
    it('rejects EXTERNAL apply mode with EXTERNAL_ONLY_NO_INTERNAL_APPLICATION', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.PUBLISHED,
        applyMode: 'EXTERNAL',
        companyId: 'company-1',
      });
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);

      await expect(
        service.submitApplication('candidate-1', 'job-1', {}),
      ).rejects.toThrow(
        new BadRequestException('EXTERNAL_ONLY_NO_INTERNAL_APPLICATION'),
      );
    });

    it("rejects when caller is OWNER of the job's company (RECRUITER_CANNOT_APPLY)", async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.PUBLISHED,
        applyMode: 'INTERNAL',
        companyId: 'company-1',
      });
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });

      await expect(
        service.submitApplication('recruiter-1', 'job-1', {}),
      ).rejects.toThrow(
        new ForbiddenException('RECRUITER_CANNOT_APPLY_TO_OWN_COMPANY'),
      );
    });

    it('returns existing active application idempotently (no second create)', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.PUBLISHED,
        applyMode: 'INTERNAL',
        companyId: 'company-1',
      });
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);
      prisma.application.findFirst.mockResolvedValue(buildAppRow());

      const result = await service.submitApplication(
        'candidate-1',
        'job-1',
        {},
      );

      expect(result.id).toBe('app-1');
      expect(prisma.application.create).not.toHaveBeenCalled();
    });

    it('validates resume MediaAsset (foreign owner → BadRequest)', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.PUBLISHED,
        applyMode: 'INTERNAL',
        companyId: 'company-1',
      });
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'OTHER_USER',
        purpose: 'resume',
        status: 'READY',
      });

      await expect(
        service.submitApplication('candidate-1', 'job-1', {
          resumeMediaAssetId: 'media-1',
        }),
      ).rejects.toThrow(new BadRequestException('RESUME_NOT_FOUND_OR_FOREIGN'));
    });

    it('creates application + emits ApplicationSubmitted on happy path', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'job-1',
        status: JobStatus.PUBLISHED,
        applyMode: 'INTERNAL',
        companyId: 'company-1',
      });
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.application.create.mockResolvedValue(buildAppRow());
      prisma.application.findUnique.mockResolvedValue(buildAppRow());

      const result = await service.submitApplication(
        'candidate-1',
        'job-1',
        {},
      );

      expect(result.id).toBe('app-1');
      expect(idempotency.claim).toHaveBeenCalledWith(
        prisma,
        'Application:submit',
        'candidate-1:job-1',
      );
      expect(prisma.application.create).toHaveBeenCalledTimes(1);
      expect(prisma.applicationStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: null,
            toStatus: ApplicationStatus.SUBMITTED,
          }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'ApplicationSubmitted' }),
      );
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      prisma.application.findUnique.mockResolvedValue(buildAppRow());
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('recruiter SUBMITTED → REVIEWED works and emits ApplicationStatusChanged', async () => {
      // Caller is recruiter (resolveEmployerRole returns 'employer')
      prisma.application.findUnique
        .mockResolvedValueOnce({
          ...buildAppRow(),
          userId: 'candidate-1', // not the caller
        })
        .mockResolvedValueOnce(
          buildAppRow({ status: ApplicationStatus.REVIEWED }),
        );

      await service.updateStatus('recruiter-1', 'app-1', {
        newStatus: ApplicationStatus.REVIEWED,
      });

      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            status: ApplicationStatus.REVIEWED,
          }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'ApplicationStatusChanged' }),
      );
    });

    it('rejects skip transition (SUBMITTED → INTERVIEWING) with INVALID_STATUS_TRANSITION', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({
        ...buildAppRow(),
        userId: 'candidate-1',
      });

      await expect(
        service.updateStatus('recruiter-1', 'app-1', {
          newStatus: ApplicationStatus.INTERVIEWING,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects from terminal state (ACCEPTED → anything) with APPLICATION_TERMINAL', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({
        ...buildAppRow({ status: ApplicationStatus.ACCEPTED }),
        userId: 'candidate-1',
      });

      await expect(
        service.updateStatus('recruiter-1', 'app-1', {
          newStatus: ApplicationStatus.REJECTED,
        }),
      ).rejects.toThrow(new BadRequestException('APPLICATION_TERMINAL'));
    });

    it('candidate cannot do recruiter transition → INSUFFICIENT_ACTOR_ROLE', async () => {
      // Caller IS the candidate (no employer role)
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);
      prisma.application.findUnique.mockResolvedValue({
        ...buildAppRow(),
        userId: 'candidate-1',
      });

      await expect(
        service.updateStatus('candidate-1', 'app-1', {
          newStatus: ApplicationStatus.REVIEWED,
        }),
      ).rejects.toThrow(new ForbiddenException('INSUFFICIENT_ACTOR_ROLE'));
    });
  });

  describe('withdraw', () => {
    it('candidate can withdraw their own SUBMITTED application', async () => {
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);
      prisma.application.findUnique.mockResolvedValue({
        ...buildAppRow(),
        userId: 'candidate-1',
      });
      // withdraw delegates to updateStatus which re-loads — mock subsequent calls
      prisma.application.findUnique
        .mockResolvedValueOnce({
          ...buildAppRow(),
          userId: 'candidate-1',
        })
        .mockResolvedValueOnce({
          ...buildAppRow({ status: ApplicationStatus.SUBMITTED }),
          userId: 'candidate-1',
        })
        .mockResolvedValueOnce(
          buildAppRow({ status: ApplicationStatus.WITHDRAWN }),
        );

      await service.withdraw('candidate-1', 'app-1');

      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'ApplicationStatusChanged',
          payload: expect.objectContaining({
            toStatus: ApplicationStatus.WITHDRAWN,
          }),
        }),
      );
    });

    it('rejects when caller is not the candidate', async () => {
      prisma.application.findUnique.mockResolvedValue({
        ...buildAppRow(),
        userId: 'candidate-1',
      });

      await expect(service.withdraw('other-user', 'app-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
