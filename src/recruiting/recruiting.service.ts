import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntitlementsService } from '../billing/entitlements/entitlements.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import type {
  AddCandidateToPoolDto,
  SaveCandidateDto,
} from './dto/save-candidate.dto';
import type {
  CreateTalentPoolDto,
  UpdateTalentPoolDto,
} from './dto/talent-pool.dto';
import type { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import type { UpdateInterviewDto } from './dto/update-interview.dto';
import type { SubmitScorecardDto } from './dto/submit-scorecard.dto';
import type { CreateOfferDto } from './dto/create-offer.dto';
import {
  buildCursorWhere,
  decodeCursor,
  paginateRows,
} from '../common/pagination/cursor';

/**
 * Recruiting domain service.
 *
 * All endpoints are company-scoped. The shared `assertEmployerRole` helper
 * resolves OWNER/ADMIN or active RecruiterSeat membership for the caller.
 * Billing entitlements are enforced: a recruiter seat can only be used if
 * the company plan still has available recruiter seats.
 */
@Injectable()
export class RecruitingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService,
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService,
  ) {}

  private async assertEmployerRole(companyId: string, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('COMPANY_NOT_FOUND');

    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (member && member.status === 'active') {
      if (member.role === 'OWNER' || member.role === 'ADMIN') return;
    }
    const seat = await this.prisma.recruiterSeat.findFirst({
      where: { companyId, userId, status: 'allocated' },
    });
    if (!seat) {
      throw new ForbiddenException('INSUFFICIENT_COMPANY_ROLE');
    }

    // Enforce billing seat limit: a recruiter seat can only be used if the
    // company plan still has available recruiter seats.
    const hasSeats = await this.entitlementsService.checkLimit(
      companyId,
      'recruiter_seats',
    );
    if (!hasSeats) {
      throw new ForbiddenException('ENTITLEMENT_EXCEEDED');
    }
  }

  // ─────────────────────── Saved candidates ───────────────────────────────

  async saveCandidate(
    userId: string,
    companyId: string,
    dto: SaveCandidateDto,
  ) {
    await this.assertEmployerRole(companyId, userId);

    // Verify candidate Profile exists and recruitingEligible=true.
    // Filter out soft-deleted profiles (e.g. removed by moderation).
    const profile = await this.prisma.profile.findFirst({
      where: { userId: dto.candidateUserId, deletedAt: null },
      select: { recruitingEligible: true },
    });
    if (!profile || !profile.recruitingEligible) {
      throw new ForbiddenException('CANDIDATE_NOT_OPTED_IN_TO_RECRUITING');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        'SavedCandidate:save',
        `${companyId}:${dto.candidateUserId}`,
      );

      const existing = await tx.savedCandidate.findFirst({
        where: {
          companyId,
          candidateUserId: dto.candidateUserId,
          deletedAt: null,
        },
      });
      if (existing) return existing;

      const saved = await tx.savedCandidate.create({
        data: {
          companyId,
          candidateUserId: dto.candidateUserId,
          savedByUserId: userId,
          sourceId: dto.sourceId ?? null,
          note: dto.note ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'recruiting.candidate.save',
          entityType: 'SavedCandidate',
          entityId: saved.id,
          metadata: { companyId, candidateUserId: dto.candidateUserId },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'CandidateSaved',
        aggregateType: 'SavedCandidate',
        aggregateId: saved.id,
        payload: {
          savedCandidateId: saved.id,
          companyId,
          candidateUserId: dto.candidateUserId,
          savedByUserId: userId,
        },
      });

      return saved;
    });
  }

  async unsaveCandidate(
    userId: string,
    companyId: string,
    candidateUserId: string,
  ) {
    await this.assertEmployerRole(companyId, userId);

    const existing = await this.prisma.savedCandidate.findFirst({
      where: { companyId, candidateUserId, deletedAt: null },
    });
    if (!existing) return;

    await this.prisma.savedCandidate.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  async listSavedCandidates(
    userId: string,
    companyId: string,
    query: { cursor?: string; limit?: number },
  ) {
    await this.assertEmployerRole(companyId, userId);
    const limit = query.limit ?? 20;

    let cursorWhere: Prisma.SavedCandidateWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = buildCursorWhere(decoded);
      }
    }

    const rows = await this.prisma.savedCandidate.findMany({
      where: { AND: [{ companyId, deletedAt: null }, cursorWhere] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasMore: hasNextPage } };
  }

  // ─────────────────────── Talent pools ───────────────────────────────────

  async createTalentPool(
    userId: string,
    companyId: string,
    dto: CreateTalentPoolDto,
  ) {
    await this.assertEmployerRole(companyId, userId);

    try {
      return await this.prisma.talentPool.create({
        data: {
          companyId,
          name: dto.name,
          description: dto.description ?? null,
          createdByUserId: userId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('TALENT_POOL_NAME_TAKEN');
      }
      throw err;
    }
  }

  async listTalentPools(userId: string, companyId: string) {
    await this.assertEmployerRole(companyId, userId);
    return this.prisma.talentPool.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async updateTalentPool(
    userId: string,
    companyId: string,
    poolId: string,
    dto: UpdateTalentPoolDto,
  ) {
    await this.assertEmployerRole(companyId, userId);
    const pool = await this.prisma.talentPool.findFirst({
      where: { id: poolId, companyId, deletedAt: null },
    });
    if (!pool) throw new NotFoundException('TALENT_POOL_NOT_FOUND');

    try {
      return await this.prisma.talentPool.update({
        where: { id: poolId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('TALENT_POOL_NAME_TAKEN');
      }
      throw err;
    }
  }

  async deleteTalentPool(userId: string, companyId: string, poolId: string) {
    await this.assertEmployerRole(companyId, userId);
    const pool = await this.prisma.talentPool.findFirst({
      where: { id: poolId, companyId, deletedAt: null },
    });
    if (!pool) throw new NotFoundException('TALENT_POOL_NOT_FOUND');

    await this.prisma.talentPool.update({
      where: { id: poolId },
      data: { deletedAt: new Date() },
    });
  }

  async addCandidateToPool(
    userId: string,
    companyId: string,
    poolId: string,
    dto: AddCandidateToPoolDto,
  ) {
    await this.assertEmployerRole(companyId, userId);
    const pool = await this.prisma.talentPool.findFirst({
      where: { id: poolId, companyId, deletedAt: null },
    });
    if (!pool) throw new NotFoundException('TALENT_POOL_NOT_FOUND');

    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        'TalentPoolCandidate:add',
        `${poolId}:${dto.candidateUserId}`,
      );

      const existing = await tx.talentPoolCandidate.findFirst({
        where: {
          talentPoolId: poolId,
          candidateUserId: dto.candidateUserId,
          deletedAt: null,
        },
      });
      if (existing) return existing;

      const created = await tx.talentPoolCandidate.create({
        data: {
          talentPoolId: poolId,
          candidateUserId: dto.candidateUserId,
          addedByUserId: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'recruiting.pool.add',
          entityType: 'TalentPoolCandidate',
          entityId: created.id,
          metadata: {
            companyId,
            poolId,
            candidateUserId: dto.candidateUserId,
          },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'CandidateAddedToTalentPool',
        aggregateType: 'TalentPoolCandidate',
        aggregateId: created.id,
        payload: {
          talentPoolCandidateId: created.id,
          talentPoolId: poolId,
          companyId,
          candidateUserId: dto.candidateUserId,
        },
      });

      return created;
    });
  }

  async removeCandidateFromPool(
    userId: string,
    companyId: string,
    poolId: string,
    candidateUserId: string,
  ) {
    await this.assertEmployerRole(companyId, userId);
    const existing = await this.prisma.talentPoolCandidate.findFirst({
      where: {
        talentPoolId: poolId,
        candidateUserId,
        deletedAt: null,
        talentPool: { companyId, deletedAt: null },
      },
    });
    if (!existing) return;
    await this.prisma.talentPoolCandidate.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  // ─────────────────────── Interview Scheduling (W2-T9) ──────────────────

  async scheduleInterview(
    userId: string,
    companyId: string,
    dto: ScheduleInterviewDto,
  ) {
    await this.assertEmployerRole(companyId, userId);

    // Verify application exists and belongs to company
    const application = await this.prisma.application.findFirst({
      where: { id: dto.applicationId, job: { companyId } },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('APPLICATION_NOT_FOUND');
    }

    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          applicationId: dto.applicationId,
          companyId,
          scheduledAt: new Date(dto.scheduledAt),
          durationMinutes: dto.durationMinutes ?? 60,
          location: dto.location ?? null,
          meetingUrl: dto.meetingUrl ?? null,
          notes: dto.notes ?? null,
          status: 'SCHEDULED',
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'InterviewScheduled',
        aggregateType: 'Interview',
        aggregateId: interview.id,
        payload: {
          interviewId: interview.id,
          applicationId: dto.applicationId,
          companyId,
          scheduledAt: dto.scheduledAt,
          scheduledByUserId: userId,
        },
      });

      return interview;
    });
  }

  async updateInterview(
    userId: string,
    companyId: string,
    interviewId: string,
    dto: UpdateInterviewDto,
  ) {
    await this.assertEmployerRole(companyId, userId);

    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, companyId },
      select: { id: true, applicationId: true, status: true },
    });
    if (!interview) {
      throw new NotFoundException('INTERVIEW_NOT_FOUND');
    }

    const data: Prisma.InterviewUpdateInput = {};
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = new Date(dto.scheduledAt);
    }
    if (dto.durationMinutes !== undefined) {
      data.durationMinutes = dto.durationMinutes;
    }
    if (dto.location !== undefined) {
      data.location = dto.location;
    }
    if (dto.meetingUrl !== undefined) {
      data.meetingUrl = dto.meetingUrl;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }
    if (dto.status !== undefined) {
      data.status = dto.status as
        | 'SCHEDULED'
        | 'COMPLETED'
        | 'CANCELLED'
        | 'NO_SHOW';
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.interview.update({
        where: { id: interviewId },
        data,
      });

      // Emit InterviewCompleted if status changed to COMPLETED
      if (dto.status === 'COMPLETED' && interview.status !== 'COMPLETED') {
        await this.outboxService.emit(tx, {
          eventType: 'InterviewCompleted',
          aggregateType: 'Interview',
          aggregateId: interviewId,
          payload: {
            interviewId,
            applicationId: interview.applicationId,
            companyId,
          },
        });
      }

      return updated;
    });
  }

  async addInterviewer(
    userId: string,
    companyId: string,
    interviewId: string,
    targetUserId: string,
  ) {
    await this.assertEmployerRole(companyId, userId);

    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, companyId },
      select: { id: true },
    });
    if (!interview) {
      throw new NotFoundException('INTERVIEW_NOT_FOUND');
    }

    // Idempotent: check if already exists
    const existing = await this.prisma.interviewer.findUnique({
      where: {
        interviewId_userId: { interviewId, userId: targetUserId },
      },
    });
    if (existing) return existing;

    return this.prisma.interviewer.create({
      data: {
        interviewId,
        userId: targetUserId,
      },
    });
  }

  async listInterviews(
    userId: string,
    companyId: string,
    query: { cursor?: string; limit?: number; applicationId?: string },
  ) {
    await this.assertEmployerRole(companyId, userId);
    const limit = query.limit ?? 20;

    const andClauses: Prisma.InterviewWhereInput[] = [{ companyId }];

    if (query.applicationId) {
      andClauses.push({ applicationId: query.applicationId });
    }

    let cursorWhere: Prisma.InterviewWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = buildCursorWhere(decoded);
      }
    }

    const rows = await this.prisma.interview.findMany({
      where: { AND: [...andClauses, cursorWhere] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { interviewers: true },
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasMore: hasNextPage } };
  }

  // ─────────────────────── Scorecard System (W2-T10) ─────────────────────

  async submitScorecard(
    userId: string,
    companyId: string,
    dto: SubmitScorecardDto,
  ) {
    await this.assertEmployerRole(companyId, userId);

    // Verify interview exists and belongs to company
    const interview = await this.prisma.interview.findFirst({
      where: { id: dto.interviewId, companyId },
      select: { id: true, applicationId: true },
    });
    if (!interview) {
      throw new NotFoundException('INTERVIEW_NOT_FOUND');
    }

    // Verify user is an interviewer for this interview
    const interviewer = await this.prisma.interviewer.findFirst({
      where: { interviewId: dto.interviewId, userId },
      select: { id: true },
    });
    if (!interviewer) {
      throw new ForbiddenException('USER_NOT_INTERVIEWER');
    }

    return this.prisma.$transaction(async (tx) => {
      const scorecard = await tx.scorecard.create({
        data: {
          interviewId: dto.interviewId,
          applicationId: interview.applicationId,
          companyId,
          overallRating: dto.overallRating,
          recommendation: dto.recommendation,
          notes: dto.notes,
          submittedByUserId: userId,
          sections: {
            create: dto.sections.map((s) => ({
              name: s.name,
              rating: s.rating,
              notes: s.notes ?? null,
            })),
          },
        },
        include: { sections: true },
      });

      await this.outboxService.emit(tx, {
        eventType: 'ScorecardSubmitted',
        aggregateType: 'Scorecard',
        aggregateId: scorecard.id,
        payload: {
          scorecardId: scorecard.id,
          interviewId: dto.interviewId,
          applicationId: interview.applicationId,
          companyId,
          submittedByUserId: userId,
        },
      });

      return scorecard;
    });
  }

  async listScorecards(
    userId: string,
    companyId: string,
    query: {
      cursor?: string;
      limit?: number;
      interviewId?: string;
      applicationId?: string;
    },
  ) {
    await this.assertEmployerRole(companyId, userId);
    const limit = query.limit ?? 20;

    const andClauses: Prisma.ScorecardWhereInput[] = [{ companyId }];

    if (query.interviewId) {
      andClauses.push({ interviewId: query.interviewId });
    }
    if (query.applicationId) {
      andClauses.push({ applicationId: query.applicationId });
    }

    let cursorWhere: Prisma.ScorecardWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = buildCursorWhere(decoded);
      }
    }

    const rows = await this.prisma.scorecard.findMany({
      where: { AND: [...andClauses, cursorWhere] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { sections: true },
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasMore: hasNextPage } };
  }

  // ─────────────────────── Offer Workflow (W2-T11) ───────────────────────

  async createOffer(userId: string, companyId: string, dto: CreateOfferDto) {
    await this.assertEmployerRole(companyId, userId);

    // Verify application exists and belongs to company
    const application = await this.prisma.application.findFirst({
      where: { id: dto.applicationId, job: { companyId } },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('APPLICATION_NOT_FOUND');
    }

    return this.prisma.offer.create({
      data: {
        applicationId: dto.applicationId,
        companyId,
        position: dto.position,
        salaryAmount: dto.salaryAmount,
        currency: dto.currency ?? 'USD',
        startDate: new Date(dto.startDate),
        expiresAt: new Date(dto.expiresAt),
        notes: dto.notes ?? null,
        status: 'DRAFT',
      },
    });
  }

  async sendOffer(userId: string, companyId: string, offerId: string) {
    await this.assertEmployerRole(companyId, userId);

    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, companyId },
      select: { id: true, status: true, applicationId: true },
    });
    if (!offer) {
      throw new NotFoundException('OFFER_NOT_FOUND');
    }
    if (offer.status !== 'DRAFT') {
      throw new ConflictException('OFFER_NOT_DRAFT');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: 'SENT' },
      });

      await this.outboxService.emit(tx, {
        eventType: 'OfferSent',
        aggregateType: 'Offer',
        aggregateId: offerId,
        payload: {
          offerId,
          applicationId: offer.applicationId,
          companyId,
        },
      });

      return updated;
    });
  }

  async respondToOffer(userId: string, offerId: string, accepted: boolean) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, status: 'SENT' },
      select: { id: true, applicationId: true, companyId: true },
    });
    if (!offer) {
      throw new NotFoundException('OFFER_NOT_FOUND_OR_NOT_SENT');
    }

    // Verify user is the candidate
    const application = await this.prisma.application.findFirst({
      where: { id: offer.applicationId, userId },
      select: { id: true },
    });
    if (!application) {
      throw new ForbiddenException('NOT_CANDIDATE_FOR_OFFER');
    }

    const newStatus = accepted ? 'ACCEPTED' : 'REJECTED';

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: newStatus },
      });

      // Update application status accordingly
      await tx.application.update({
        where: { id: offer.applicationId },
        data: {
          status: accepted ? 'ACCEPTED' : 'REJECTED',
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'OfferResponded',
        aggregateType: 'Offer',
        aggregateId: offerId,
        payload: {
          offerId,
          applicationId: offer.applicationId,
          companyId: offer.companyId,
          accepted,
        },
      });

      return updated;
    });
  }
}
