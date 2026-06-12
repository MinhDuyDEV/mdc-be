import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EntitlementsService } from '../billing/entitlements/entitlements.service';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { IdempotencyService } from '../outbox/idempotency.service';
import { Recommendation } from './dto/submit-scorecard.dto';
import { RecruitingService } from './recruiting.service';

interface MockPrisma {
  company: { findFirst: jest.Mock };
  companyMember: { findUnique: jest.Mock };
  recruiterSeat: { findFirst: jest.Mock };
  profile: { findUnique: jest.Mock; findFirst: jest.Mock };
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
  application: { findFirst: jest.Mock; update: jest.Mock };
  interview: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  interviewer: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  scorecard: { create: jest.Mock; findMany: jest.Mock };
  offer: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }) },
    companyMember: { findUnique: jest.fn() },
    recruiterSeat: { findFirst: jest.fn() },
    profile: { findUnique: jest.fn(), findFirst: jest.fn() },
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
    application: { findFirst: jest.fn(), update: jest.fn() },
    interview: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    interviewer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    scorecard: { create: jest.fn(), findMany: jest.fn() },
    offer: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
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
      prisma.profile.findFirst.mockResolvedValue({
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
      prisma.profile.findFirst.mockResolvedValue({
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
      prisma.profile.findFirst.mockResolvedValue({
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

  // ── Interview Scheduling ──────────────────────────────────────────

  describe('scheduleInterview', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('creates interview and emits InterviewScheduled event', async () => {
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1' });
      const mockInterview = {
        id: 'interview-1',
        applicationId: 'app-1',
        companyId: 'c-1',
      };
      prisma.interview.create.mockResolvedValue(mockInterview);

      const result = await service.scheduleInterview('user-1', 'c-1', {
        applicationId: 'app-1',
        scheduledAt: '2026-06-15T10:00:00Z',
      });

      expect(result).toBe(mockInterview);
      expect(prisma.interview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            applicationId: 'app-1',
            status: 'SCHEDULED',
          }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'InterviewScheduled' }),
      );
    });

    it('rejects when application not found', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await expect(
        service.scheduleInterview('user-1', 'c-1', {
          applicationId: 'missing',
          scheduledAt: '2026-06-15T10:00:00Z',
        }),
      ).rejects.toThrow(new NotFoundException('APPLICATION_NOT_FOUND'));
    });
  });

  describe('updateInterview', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('updates interview fields and does not emit event for non-COMPLETED', async () => {
      prisma.interview.findFirst.mockResolvedValue({
        id: 'interview-1',
        applicationId: 'app-1',
        status: 'SCHEDULED',
      });
      const updated = { id: 'interview-1', location: 'Room 42' };
      prisma.interview.update.mockResolvedValue(updated);

      const result = await service.updateInterview(
        'user-1',
        'c-1',
        'interview-1',
        {
          location: 'Room 42',
        },
      );

      expect(result).toBe(updated);
      expect(outbox.emit).not.toHaveBeenCalled();
    });

    it('emits InterviewCompleted when status becomes COMPLETED', async () => {
      prisma.interview.findFirst.mockResolvedValue({
        id: 'interview-1',
        applicationId: 'app-1',
        status: 'SCHEDULED',
      });
      prisma.interview.update.mockResolvedValue({
        id: 'interview-1',
        status: 'COMPLETED',
      });

      await service.updateInterview('user-1', 'c-1', 'interview-1', {
        status: 'COMPLETED',
      });

      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'InterviewCompleted' }),
      );
    });

    it('rejects when interview not found', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInterview('user-1', 'c-1', 'missing', {}),
      ).rejects.toThrow(new NotFoundException('INTERVIEW_NOT_FOUND'));
    });
  });

  describe('addInterviewer', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('creates interviewer', async () => {
      prisma.interview.findFirst.mockResolvedValue({ id: 'interview-1' });
      prisma.interviewer.findUnique.mockResolvedValue(null);
      const created = {
        id: 'iv-1',
        interviewId: 'interview-1',
        userId: 'target-1',
      };
      prisma.interviewer.create.mockResolvedValue(created);

      const result = await service.addInterviewer(
        'user-1',
        'c-1',
        'interview-1',
        'target-1',
      );

      expect(result).toBe(created);
    });

    it('is idempotent — returns existing interviewer', async () => {
      prisma.interview.findFirst.mockResolvedValue({ id: 'interview-1' });
      const existing = {
        id: 'iv-1',
        interviewId: 'interview-1',
        userId: 'target-1',
      };
      prisma.interviewer.findUnique.mockResolvedValue(existing);

      const result = await service.addInterviewer(
        'user-1',
        'c-1',
        'interview-1',
        'target-1',
      );

      expect(result).toBe(existing);
      expect(prisma.interviewer.create).not.toHaveBeenCalled();
    });

    it('rejects when interview not found', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.addInterviewer('user-1', 'c-1', 'missing', 'target-1'),
      ).rejects.toThrow(new NotFoundException('INTERVIEW_NOT_FOUND'));
    });
  });

  describe('listInterviews', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('returns paginated results', async () => {
      const rows = [
        { id: 'i-1', createdAt: new Date('2026-06-01'), interviewers: [] },
        { id: 'i-2', createdAt: new Date('2026-06-02'), interviewers: [] },
      ];
      prisma.interview.findMany.mockResolvedValue(rows);

      const result = await service.listInterviews('user-1', 'c-1', {
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('supports applicationId filter', async () => {
      prisma.interview.findMany.mockResolvedValue([]);

      await service.listInterviews('user-1', 'c-1', {
        limit: 20,
        applicationId: 'app-1',
      });

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { companyId: 'c-1' },
              { applicationId: 'app-1' },
            ]),
          }),
        }),
      );
    });
  });

  // ── Scorecard System ──────────────────────────────────────────────

  describe('submitScorecard', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('creates scorecard with sections and emits ScorecardSubmitted', async () => {
      prisma.interview.findFirst.mockResolvedValue({
        id: 'interview-1',
        applicationId: 'app-1',
      });
      prisma.interviewer.findFirst.mockResolvedValue({ id: 'iv-1' });
      const mockScorecard = {
        id: 'sc-1',
        interviewId: 'interview-1',
        sections: [{ name: 'coding', rating: 4 }],
      };
      prisma.scorecard.create.mockResolvedValue(mockScorecard);

      const result = await service.submitScorecard('user-1', 'c-1', {
        interviewId: 'interview-1',
        overallRating: 4,
        recommendation: Recommendation.HIRE,
        notes: 'Good candidate',
        sections: [{ name: 'coding', rating: 4 }],
      });

      expect(result).toBe(mockScorecard);
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'ScorecardSubmitted' }),
      );
    });

    it('rejects when interview not found', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.submitScorecard('user-1', 'c-1', {
          interviewId: 'missing',
          overallRating: 3,
          recommendation: Recommendation.NEUTRAL,
          notes: 'OK',
          sections: [],
        }),
      ).rejects.toThrow(new NotFoundException('INTERVIEW_NOT_FOUND'));
    });

    it('rejects when user is not an interviewer', async () => {
      prisma.interview.findFirst.mockResolvedValue({
        id: 'interview-1',
        applicationId: 'app-1',
      });
      prisma.interviewer.findFirst.mockResolvedValue(null);

      await expect(
        service.submitScorecard('user-1', 'c-1', {
          interviewId: 'interview-1',
          overallRating: 3,
          recommendation: Recommendation.NEUTRAL,
          notes: 'OK',
          sections: [],
        }),
      ).rejects.toThrow(new ForbiddenException('USER_NOT_INTERVIEWER'));
    });
  });

  describe('listScorecards', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('returns paginated results', async () => {
      const rows = [
        { id: 'sc-1', createdAt: new Date('2026-06-01'), sections: [] },
      ];
      prisma.scorecard.findMany.mockResolvedValue(rows);

      const result = await service.listScorecards('user-1', 'c-1', {
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasNextPage).toBe(false);
    });
  });

  // ── Offer Workflow ────────────────────────────────────────────────

  describe('createOffer', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('creates offer in DRAFT status', async () => {
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1' });
      const mockOffer = {
        id: 'offer-1',
        applicationId: 'app-1',
        status: 'DRAFT',
      };
      prisma.offer.create.mockResolvedValue(mockOffer);

      const result = await service.createOffer('user-1', 'c-1', {
        applicationId: 'app-1',
        position: 'Engineer',
        salaryAmount: 100000,
        startDate: '2026-07-01',
        expiresAt: '2026-07-15',
      });

      expect(result).toBe(mockOffer);
      expect(prisma.offer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('rejects when application not found', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await expect(
        service.createOffer('user-1', 'c-1', {
          applicationId: 'missing',
          position: 'Engineer',
          salaryAmount: 100000,
          startDate: '2026-07-01',
          expiresAt: '2026-07-15',
        }),
      ).rejects.toThrow(new NotFoundException('APPLICATION_NOT_FOUND'));
    });
  });

  describe('sendOffer', () => {
    beforeEach(() => {
      prisma.companyMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        status: 'active',
      });
    });

    it('updates status to SENT and emits OfferSent', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        id: 'offer-1',
        status: 'DRAFT',
        applicationId: 'app-1',
      });
      const updated = { id: 'offer-1', status: 'SENT' };
      prisma.offer.update.mockResolvedValue(updated);

      const result = await service.sendOffer('user-1', 'c-1', 'offer-1');

      expect(result).toBe(updated);
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'OfferSent' }),
      );
    });

    it('rejects when offer not found', async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.sendOffer('user-1', 'c-1', 'missing'),
      ).rejects.toThrow(new NotFoundException('OFFER_NOT_FOUND'));
    });

    it('rejects when offer not in DRAFT', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        id: 'offer-1',
        status: 'SENT',
        applicationId: 'app-1',
      });

      await expect(
        service.sendOffer('user-1', 'c-1', 'offer-1'),
      ).rejects.toThrow(new ConflictException('OFFER_NOT_DRAFT'));
    });
  });

  describe('respondToOffer', () => {
    it('accepts offer — updates status to ACCEPTED and emits OfferResponded', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        id: 'offer-1',
        applicationId: 'app-1',
        companyId: 'c-1',
      });
      const updated = { id: 'offer-1', status: 'ACCEPTED' };
      prisma.offer.update.mockResolvedValue(updated);
      prisma.application.update.mockResolvedValue({});

      const result = await service.respondToOffer('user-1', 'offer-1', true);

      expect(result).toBe(updated);
      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: { status: 'ACCEPTED' },
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'OfferResponded',
          payload: expect.objectContaining({ accepted: true }),
        }),
      );
    });

    it('declines offer — updates status to REJECTED and emits OfferResponded', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        id: 'offer-2',
        applicationId: 'app-2',
        companyId: 'c-1',
      });
      const updated = { id: 'offer-2', status: 'REJECTED' };
      prisma.offer.update.mockResolvedValue(updated);
      prisma.application.update.mockResolvedValue({});

      const result = await service.respondToOffer('user-1', 'offer-2', false);

      expect(result).toBe(updated);
      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REJECTED' },
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: 'OfferResponded',
          payload: expect.objectContaining({ accepted: false }),
        }),
      );
    });

    it('rejects when offer not found or not SENT', async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.respondToOffer('user-1', 'missing', true),
      ).rejects.toThrow(new NotFoundException('OFFER_NOT_FOUND_OR_NOT_SENT'));
    });

    it('rejects when user is not the candidate', async () => {
      // Combined query with application: { userId } returns null for wrong user
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(
        service.respondToOffer('other-user', 'offer-1', true),
      ).rejects.toThrow(new NotFoundException('OFFER_NOT_FOUND_OR_NOT_SENT'));
    });
  });
});
