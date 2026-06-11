import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EntitlementsService } from "../billing/entitlements/entitlements.service";
import { PrismaService } from "../infra/prisma/prisma.service";
import { IdempotencyService } from "../outbox/idempotency.service";
import { OutboxService } from "../outbox/outbox.service";
import type { AddCandidateToPoolDto, SaveCandidateDto } from "./dto/save-candidate.dto";
import type { CreateTalentPoolDto, UpdateTalentPoolDto } from "./dto/talent-pool.dto";
import { buildCursorWhere, decodeCursor, paginateRows } from "../common/pagination/cursor";

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
    if (!company) throw new NotFoundException("COMPANY_NOT_FOUND");

    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (member && member.status === "active") {
      if (member.role === "OWNER" || member.role === "ADMIN") return;
    }
    const seat = await this.prisma.recruiterSeat.findFirst({
      where: { companyId, userId, status: "allocated" },
    });
    if (!seat) {
      throw new ForbiddenException("INSUFFICIENT_COMPANY_ROLE");
    }

    // Enforce billing seat limit: a recruiter seat can only be used if the
    // company plan still has available recruiter seats.
    const hasSeats = await this.entitlementsService.checkLimit(companyId, "recruiter_seats");
    if (!hasSeats) {
      throw new ForbiddenException("ENTITLEMENT_EXCEEDED");
    }
  }

  // ─────────────────────── Saved candidates ───────────────────────────────

  async saveCandidate(userId: string, companyId: string, dto: SaveCandidateDto) {
    await this.assertEmployerRole(companyId, userId);

    // Verify candidate Profile exists and recruitingEligible=true.
    // Filter out soft-deleted profiles (e.g. removed by moderation).
    const profile = await this.prisma.profile.findFirst({
      where: { userId: dto.candidateUserId, deletedAt: null },
      select: { recruitingEligible: true },
    });
    if (!profile || !profile.recruitingEligible) {
      throw new ForbiddenException("CANDIDATE_NOT_OPTED_IN_TO_RECRUITING");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        "SavedCandidate:save",
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
          action: "recruiting.candidate.save",
          entityType: "SavedCandidate",
          entityId: saved.id,
          metadata: { companyId, candidateUserId: dto.candidateUserId },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: "CandidateSaved",
        aggregateType: "SavedCandidate",
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

  async unsaveCandidate(userId: string, companyId: string, candidateUserId: string) {
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasMore: hasNextPage } };
  }

  // ─────────────────────── Talent pools ───────────────────────────────────

  async createTalentPool(userId: string, companyId: string, dto: CreateTalentPoolDto) {
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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("TALENT_POOL_NAME_TAKEN");
      }
      throw err;
    }
  }

  async listTalentPools(userId: string, companyId: string) {
    await this.assertEmployerRole(companyId, userId);
    return this.prisma.talentPool.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    if (!pool) throw new NotFoundException("TALENT_POOL_NOT_FOUND");

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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("TALENT_POOL_NAME_TAKEN");
      }
      throw err;
    }
  }

  async deleteTalentPool(userId: string, companyId: string, poolId: string) {
    await this.assertEmployerRole(companyId, userId);
    const pool = await this.prisma.talentPool.findFirst({
      where: { id: poolId, companyId, deletedAt: null },
    });
    if (!pool) throw new NotFoundException("TALENT_POOL_NOT_FOUND");

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
    if (!pool) throw new NotFoundException("TALENT_POOL_NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        "TalentPoolCandidate:add",
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
          action: "recruiting.pool.add",
          entityType: "TalentPoolCandidate",
          entityId: created.id,
          metadata: {
            companyId,
            poolId,
            candidateUserId: dto.candidateUserId,
          },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: "CandidateAddedToTalentPool",
        aggregateType: "TalentPoolCandidate",
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
}
