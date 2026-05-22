import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EntitlementsService } from '../billing/entitlements/entitlements.service';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { IdempotencyService } from '../outbox/idempotency.service';
import { RecruitingService } from './recruiting.service';

interface MockPrisma {
  company: { findFirst: jest.Mock };
  companyMember: { findUnique: jest.Mock };
  recruiterSeat: { findFirst: jest.Mock };
  profile: { findUnique: jest.Mock };
  savedCandidate: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  talentPool: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  talentPoolCandidate: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }) },
    companyMember: { findUnique: jest.fn() },
    recruiterSeat: { findFirst: jest.fn() },
    profile: { findUnique: jest.fn() },
    savedCandidate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    talentPool: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    talentPoolCandidate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (cb: (tx: MockPrisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe('RecruitingService', () => {
  let prisma: MockPrisma;
  let outbox: { emit: jest.Mock };
  let idempotency: { claim: jest.Mock };
  let entitlements: { checkLimit: jest.Mock; consumeCredit: jest.Mock };
  let service: RecruitingService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    outbox = { emit: jest.fn().mockResolvedValue(undefined) };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    entitlements = {
      checkLimit: jest.fn().mockResolvedValue(true),
      consumeCredit: jest.fn(),
    };
    service = new RecruitingService(
      prisma as unknown as PrismaService,
      outbox,
      idempotency as unknown as IdempotencyService,
      entitlements as unknown as EntitlementsService,
    );
  });

  describe('authorization', () => {
    it('rejects non-recruiter members with INSUFFICIENT_COMPANY_ROLE', async () => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'MEMBER',
        status: 'active',
      });
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);

      await expect(
        service.listSavedCandidates('user-1', 'c-1', { limit: 20 }),
      ).rejects.toThrow(new ForbiddenException('INSUFFICIENT_COMPANY_ROLE'));
    });

    it('allows OWNER role', async () => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
      prisma.savedCandidate.findMany.mockResolvedValue([]);
      await expect(
        service.listSavedCandidates('user-1', 'c-1', { limit: 20 }),
      ).resolves.toBeDefined();
    });

    it('allows MEMBER with active RecruiterSeat', async () => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'MEMBER',
        status: 'active',
      });
      prisma.recruiterSeat.findFirst.mockResolvedValue({ id: 'seat-1' });
      prisma.savedCandidate.findMany.mockResolvedValue([]);
      await expect(
        service.listSavedCandidates('user-1', 'c-1', { limit: 20 }),
      ).resolves.toBeDefined();
    });
  });

  describe('saveCandidate', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('rejects when candidate Profile.recruitingEligible=false', async () => {
      prisma.profile.findUnique.mockResolvedValue({
        recruitingEligible: false,
      });

      await expect(
        service.saveCandidate('user-1', 'c-1', {
          candidateUserId: 'cand-1',
        }),
      ).rejects.toThrow(
        new ForbiddenException('CANDIDATE_NOT_OPTED_IN_TO_RECRUITING'),
      );
    });

    it('is idempotent — returns existing active row', async () => {
      prisma.profile.findUnique.mockResolvedValue({
        recruitingEligible: true,
      });
      const existing = {
        id: 'saved-1',
        companyId: 'c-1',
        candidateUserId: 'cand-1',
      };
      prisma.savedCandidate.findFirst.mockResolvedValue(existing);

      const result = await service.saveCandidate('user-1', 'c-1', {
        candidateUserId: 'cand-1',
      });

      expect(result).toBe(existing);
      expect(prisma.savedCandidate.create).not.toHaveBeenCalled();
    });

    it('creates new SavedCandidate, audits, emits CandidateSaved', async () => {
      prisma.profile.findUnique.mockResolvedValue({
        recruitingEligible: true,
      });
      prisma.savedCandidate.findFirst.mockResolvedValue(null);
      prisma.savedCandidate.create.mockResolvedValue({
        id: 'saved-1',
        companyId: 'c-1',
        candidateUserId: 'cand-1',
      });

      await service.saveCandidate('user-1', 'c-1', {
        candidateUserId: 'cand-1',
      });

      expect(prisma.savedCandidate.create).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'CandidateSaved' }),
      );
    });
  });

  describe('createTalentPool — name conflict', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('returns 409 TALENT_POOL_NAME_TAKEN on partial unique index P2002', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
      prisma.talentPool.create.mockRejectedValue(p2002);

      await expect(
        service.createTalentPool('user-1', 'c-1', { name: 'engineering' }),
      ).rejects.toThrow(new ConflictException('TALENT_POOL_NAME_TAKEN'));
    });

    it('creates pool on happy path', async () => {
      prisma.talentPool.create.mockResolvedValue({
        id: 'pool-1',
        companyId: 'c-1',
        name: 'engineering',
      });

      const result = await service.createTalentPool('user-1', 'c-1', {
        name: 'engineering',
      });

      expect(result.id).toBe('pool-1');
    });
  });

  describe('addCandidateToPool — idempotency', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
      prisma.talentPool.findFirst.mockResolvedValue({
        id: 'pool-1',
        companyId: 'c-1',
      });
    });

    it('is idempotent — returns existing membership when already present', async () => {
      const existing = { id: 'tpc-1', talentPoolId: 'pool-1' };
      prisma.talentPoolCandidate.findFirst.mockResolvedValue(existing);

      const result = await service.addCandidateToPool(
        'user-1',
        'c-1',
        'pool-1',
        {
          candidateUserId: 'cand-1',
        },
      );
      expect(result).toBe(existing);
      expect(prisma.talentPoolCandidate.create).not.toHaveBeenCalled();
    });

    it('emits CandidateAddedToTalentPool on new membership', async () => {
      prisma.talentPoolCandidate.findFirst.mockResolvedValue(null);
      prisma.talentPoolCandidate.create.mockResolvedValue({
        id: 'tpc-1',
        talentPoolId: 'pool-1',
        candidateUserId: 'cand-1',
      });

      await service.addCandidateToPool('user-1', 'c-1', 'pool-1', {
        candidateUserId: 'cand-1',
      });

      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'CandidateAddedToTalentPool' }),
      );
    });

    it('rejects when pool does not exist', async () => {
      prisma.talentPool.findFirst.mockResolvedValue(null);

      await expect(
        service.addCandidateToPool('user-1', 'c-1', 'pool-1', {
          candidateUserId: 'cand-1',
        }),
      ).rejects.toThrow(new NotFoundException('TALENT_POOL_NOT_FOUND'));
    });
  });
});
