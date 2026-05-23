import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplyMode, JobStatus, Prisma } from '@prisma/client';
import { EntitlementsService } from '../billing/entitlements/entitlements.service';
import type { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import type { PrismaTransaction } from '../infra/prisma';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import type { CreateJobDto } from './dto/create-job.dto';
import { toJobResponseDto } from './dto/job.response.dto';
import type { ListJobsQueryDto } from './dto/list-jobs.query.dto';
import type { UpdateJobDto } from './dto/update-job.dto';

/**
 * Validates the mutual exclusivity rule between Job.applyMode and Job.applyUrl.
 * - INTERNAL: applyUrl MUST be absent.
 * - EXTERNAL / HYBRID: applyUrl MUST be present.
 *
 * Called both in createJob (raw DTO) and in updateJob (effective merged values).
 */
function validateApplyMode(
  applyMode: ApplyMode,
  applyUrl?: string | null,
): void {
  if (applyMode === ApplyMode.INTERNAL && applyUrl) {
    throw new BadRequestException('INTERNAL_NO_APPLY_URL');
  }
  if (applyMode === ApplyMode.EXTERNAL && !applyUrl) {
    throw new BadRequestException('EXTERNAL_REQUIRES_APPLY_URL');
  }
  if (applyMode === ApplyMode.HYBRID && !applyUrl) {
    throw new BadRequestException('HYBRID_REQUIRES_APPLY_URL');
  }
}

const JOB_INCLUDES = { skills: true } as const;

interface CursorPayload {
  createdAt: string;
  id: string;
}

interface FtsCursorPayload {
  rank: number;
  publishedAt: string;
  id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
  ).toString('base64');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as CursorPayload;
    if (!decoded?.createdAt || !decoded?.id) return null;
    return decoded;
  } catch {
    return null;
  }
}

function encodeFtsCursor(rank: number, publishedAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ rank, publishedAt: publishedAt.toISOString(), id }),
  ).toString('base64');
}

function decodeFtsCursor(cursor: string): FtsCursorPayload | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as FtsCursorPayload;
    if (
      typeof decoded?.rank !== 'number' ||
      !decoded?.publishedAt ||
      !decoded?.id
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Jobs domain service.
 *
 * Authorization NOTE: CompanyRoleGuard cannot be applied to /jobs/:id routes
 * because it resolves companyId from `req.params.id`, but on job routes :id is
 * the jobId. Authorization for mutating routes is therefore enforced in the
 * service via assertCanManageJob (load Job → check CompanyMember → check
 * RecruiterSeat). EmailVerifiedGuard handles the email-verification gate at
 * the controller layer.
 */
@Injectable()
export class JobsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService,
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /**
   * Loads the Job (must not be deleted) and verifies the user can manage it.
   * Allowed: company OWNER/ADMIN, or active RecruiterSeat (status='allocated').
   *
   * Throws:
   *  - NotFoundException('JOB_NOT_FOUND')
   *  - ForbiddenException('NOT_COMPANY_MEMBER')
   *  - ForbiddenException('INSUFFICIENT_COMPANY_ROLE')
   */
  async assertCanManageJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      include: JOB_INCLUDES,
    });
    if (!job) throw new NotFoundException('JOB_NOT_FOUND');

    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: job.companyId, userId } },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('NOT_COMPANY_MEMBER');
    }

    if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
      const seat = await this.prisma.recruiterSeat.findFirst({
        where: {
          companyId: job.companyId,
          userId,
          status: 'allocated',
        },
      });
      if (!seat) {
        throw new ForbiddenException('INSUFFICIENT_COMPANY_ROLE');
      }
    }

    return job;
  }

  async createJob(userId: string, dto: CreateJobDto) {
    validateApplyMode(dto.applyMode, dto.applyUrl);

    // Verify the user can post for the requested company.
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: dto.companyId, userId } },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('NOT_COMPANY_MEMBER');
    }
    if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
      const seat = await this.prisma.recruiterSeat.findFirst({
        where: { companyId: dto.companyId, userId, status: 'allocated' },
      });
      if (!seat) throw new ForbiddenException('INSUFFICIENT_COMPANY_ROLE');
    }

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          companyId: dto.companyId,
          title: dto.title,
          description: dto.description,
          applyMode: dto.applyMode,
          applyUrl: dto.applyUrl ?? null,
          employmentType: dto.employmentType,
          workplaceType: dto.workplaceType,
          location: dto.location ?? null,
          salaryMin: dto.salaryMin ?? null,
          salaryMax: dto.salaryMax ?? null,
          salaryCurrency: dto.salaryCurrency ?? null,
          createdByUserId: userId,
          ...(dto.skillIds?.length
            ? {
                skills: {
                  create: dto.skillIds.map((skillId) => ({ skillId })),
                },
              }
            : {}),
        },
        include: JOB_INCLUDES,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'job.create',
          entityType: 'Job',
          entityId: job.id,
          metadata: { title: job.title, companyId: job.companyId },
        },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'JobCreated',
        aggregateType: 'Job',
        aggregateId: job.id,
        payload: {
          jobId: job.id,
          companyId: job.companyId,
          createdByUserId: userId,
        },
      });

      return toJobResponseDto(job);
    });
  }

  async updateJob(userId: string, jobId: string, dto: UpdateJobDto) {
    const job = await this.assertCanManageJob(userId, jobId);

    const effectiveMode = dto.applyMode ?? job.applyMode;
    const effectiveUrl =
      dto.applyUrl !== undefined ? dto.applyUrl : job.applyUrl;
    validateApplyMode(effectiveMode, effectiveUrl);

    const changes = Object.keys(dto).filter((k) => k !== 'skillIds');

    return this.prisma.$transaction(async (tx) => {
      if (dto.skillIds !== undefined) {
        await tx.jobSkill.deleteMany({ where: { jobId } });
        if (dto.skillIds.length > 0) {
          await tx.jobSkill.createMany({
            data: dto.skillIds.map((skillId) => ({ jobId, skillId })),
            skipDuplicates: true,
          });
        }
      }

      const updated = await tx.job.update({
        where: { id: jobId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.applyMode !== undefined && { applyMode: dto.applyMode }),
          ...(dto.applyUrl !== undefined && { applyUrl: dto.applyUrl }),
          ...(dto.employmentType !== undefined && {
            employmentType: dto.employmentType,
          }),
          ...(dto.workplaceType !== undefined && {
            workplaceType: dto.workplaceType,
          }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.salaryMin !== undefined && { salaryMin: dto.salaryMin }),
          ...(dto.salaryMax !== undefined && { salaryMax: dto.salaryMax }),
          ...(dto.salaryCurrency !== undefined && {
            salaryCurrency: dto.salaryCurrency,
          }),
        },
        include: JOB_INCLUDES,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'job.update',
          entityType: 'Job',
          entityId: jobId,
          metadata: { changes },
        },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'JobUpdated',
        aggregateType: 'Job',
        aggregateId: jobId,
        payload: { jobId, companyId: updated.companyId, changes },
      });

      return toJobResponseDto(updated);
    });
  }

  async getJob(jobId: string, userId?: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      include: JOB_INCLUDES,
    });
    if (!job) throw new NotFoundException('JOB_NOT_FOUND');

    if (job.status === JobStatus.PUBLISHED) {
      return toJobResponseDto(job);
    }

    // Non-published jobs require active membership in the owning company.
    if (!userId) throw new NotFoundException('JOB_NOT_FOUND');

    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: job.companyId, userId } },
    });
    if (!member || member.status !== 'active') {
      throw new NotFoundException('JOB_NOT_FOUND');
    }

    return toJobResponseDto(job);
  }

  async listJobs(query: ListJobsQueryDto, userId?: string) {
    if (query.q) return this.listJobsWithFts(query, userId);

    // Only company members may request non-PUBLISHED status.
    // Anonymous callers always get PUBLISHED. Authenticated callers get
    // PUBLISHED unless they request a specific status AND are a member of
    // the company they are querying.
    let status: JobStatus = JobStatus.PUBLISHED;
    if (userId && query.status) {
      if (query.status !== JobStatus.PUBLISHED && query.companyId) {
        const member = await this.prisma.companyMember.findUnique({
          where: { companyId_userId: { companyId: query.companyId, userId } },
          select: { role: true, status: true },
        });
        if (
          member &&
          member.status === 'active' &&
          (member.role === 'OWNER' || member.role === 'ADMIN')
        ) {
          status = query.status;
        } else {
          const seat = await this.prisma.recruiterSeat.findFirst({
            where: { companyId: query.companyId, userId, status: 'allocated' },
            select: { id: true },
          });
          if (seat) status = query.status;
        }
      }
    }

    const baseWhere: Prisma.JobWhereInput = {
      deletedAt: null,
      status,
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.employmentType && { employmentType: query.employmentType }),
      ...(query.workplaceType && { workplaceType: query.workplaceType }),
      ...(query.location && {
        location: { contains: query.location, mode: 'insensitive' },
      }),
      ...(query.skillId && { skills: { some: { skillId: query.skillId } } }),
    };

    let cursorWhere: Prisma.JobWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.createdAt);
        cursorWhere = {
          OR: [
            { createdAt: { lt: cursorDate } },
            {
              AND: [{ createdAt: cursorDate }, { id: { lt: decoded.id } }],
            },
          ],
        };
      }
    }

    const limit = query.limit ?? 20;
    const rows = await this.prisma.job.findMany({
      where: { AND: [baseWhere, cursorWhere] },
      include: JOB_INCLUDES,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : undefined;

    return {
      data: items.map(toJobResponseDto),
      meta: { nextCursor, hasMore },
    };
  }

  private async listJobsWithFts(query: ListJobsQueryDto, userId?: string) {
    const tokens = (query.q ?? '')
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean);

    if (tokens.length === 0) {
      return { data: [], meta: { nextCursor: undefined, hasMore: false } };
    }

    const tsQuery = tokens.join(' & ');
    let status: JobStatus = JobStatus.PUBLISHED;
    if (userId && query.status) {
      if (query.status !== JobStatus.PUBLISHED && query.companyId) {
        const member = await this.prisma.companyMember.findUnique({
          where: { companyId_userId: { companyId: query.companyId, userId } },
          select: { role: true, status: true },
        });
        if (
          member &&
          member.status === 'active' &&
          (member.role === 'OWNER' || member.role === 'ADMIN')
        ) {
          status = query.status;
        } else {
          const seat = await this.prisma.recruiterSeat.findFirst({
            where: { companyId: query.companyId, userId, status: 'allocated' },
            select: { id: true },
          });
          if (seat) status = query.status;
        }
      }
    }
    const limit = query.limit ?? 20;

    // Cursor pagination: keyset on (ts_rank DESC, published_at DESC NULLS LAST, id DESC).
    let cursorFilter = Prisma.sql``;
    if (query.cursor) {
      const decoded = decodeFtsCursor(query.cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.publishedAt);
        cursorFilter = Prisma.sql`AND (
          r.rank < ${decoded.rank}
          OR (r.rank = ${decoded.rank} AND r.published_at < ${cursorDate}::timestamptz)
          OR (r.rank = ${decoded.rank} AND r.published_at = ${cursorDate}::timestamptz AND r.id < ${decoded.id}::uuid)
        )`;
      }
    }

    type FtsRow = { id: string; rank: number; published_at: Date };
    const rawRows = await this.prisma.$queryRaw<FtsRow[]>(
      Prisma.sql`
        WITH ranked AS (
          SELECT id,
                 ts_rank(search_vector, to_tsquery('english', ${tsQuery})) AS rank,
                 published_at
          FROM jobs
          WHERE deleted_at IS NULL
            AND status = ${status}::"JobStatus"
            AND search_vector @@ to_tsquery('english', ${tsQuery})
        )
        SELECT id, rank, published_at FROM ranked r
        WHERE true ${cursorFilter}
        ORDER BY r.rank DESC, r.published_at DESC NULLS LAST, r.id DESC
        LIMIT ${limit + 1}
      `,
    );

    if (rawRows.length === 0) {
      return { data: [], meta: { nextCursor: undefined, hasMore: false } };
    }

    const hasMore = rawRows.length > limit;
    const visible = hasMore ? rawRows.slice(0, limit) : rawRows;
    const last = visible[visible.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeFtsCursor(last.rank, last.published_at, last.id)
        : undefined;

    const ids = visible.map((r) => r.id);
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: ids } },
      include: JOB_INCLUDES,
    });
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((j): j is NonNullable<typeof j> => j !== undefined);

    return {
      data: ordered.map(toJobResponseDto),
      meta: { nextCursor, hasMore },
    };
  }

  async publishJob(userId: string, jobId: string) {
    const job = await this.assertCanManageJob(userId, jobId);
    if (job.status !== JobStatus.DRAFT) {
      throw new BadRequestException('INVALID_STATUS_TRANSITION');
    }

    return this.prisma.$transaction(async (tx) => {
      // Consume credit inside the SAME transaction — credit decrement and
      // status update commit together, or both roll back.
      await this.entitlementsService.consumeCredit(
        job.companyId,
        'job_posts',
        1,
        'Job',
        jobId,
        tx,
      );

      const updated = await tx.job.update({
        where: { id: jobId },
        data: { status: JobStatus.PUBLISHED, publishedAt: new Date() },
        include: JOB_INCLUDES,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'job.publish',
          entityType: 'Job',
          entityId: jobId,
          metadata: { companyId: job.companyId },
        },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'JobPublished',
        aggregateType: 'Job',
        aggregateId: jobId,
        payload: { jobId, companyId: updated.companyId },
      });

      return toJobResponseDto(updated);
    });
  }

  async closeJob(userId: string, jobId: string) {
    const job = await this.assertCanManageJob(userId, jobId);
    if (job.status !== JobStatus.PUBLISHED) {
      throw new BadRequestException('INVALID_STATUS_TRANSITION');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id: jobId },
        data: { status: JobStatus.CLOSED, closedAt: new Date() },
        include: JOB_INCLUDES,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'job.close',
          entityType: 'Job',
          entityId: jobId,
          metadata: { companyId: job.companyId },
        },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'JobClosed',
        aggregateType: 'Job',
        aggregateId: jobId,
        payload: { jobId, companyId: updated.companyId },
      });

      return toJobResponseDto(updated);
    });
  }

  async deleteJob(userId: string, jobId: string) {
    const job = await this.assertCanManageJob(userId, jobId);

    return this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: { status: JobStatus.DELETED, deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'job.delete',
          entityType: 'Job',
          entityId: jobId,
          metadata: { companyId: job.companyId },
        },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'JobDeleted',
        aggregateType: 'Job',
        aggregateId: jobId,
        payload: { jobId, companyId: job.companyId },
      });
    });
  }

  async saveJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!job || job.status !== JobStatus.PUBLISHED) {
      throw new NotFoundException('JOB_NOT_FOUND');
    }

    await this.idempotencyService.claim('SavedJob:save', `${userId}:${jobId}`);

    const existing = await this.prisma.savedJob.findFirst({
      where: { userId, jobId, deletedAt: null },
    });
    if (existing) return existing;

    return this.prisma.savedJob.create({ data: { userId, jobId } });
  }

  async unsaveJob(userId: string, jobId: string) {
    await this.idempotencyService.claim(
      'SavedJob:unsave',
      `${userId}:${jobId}`,
    );

    const existing = await this.prisma.savedJob.findFirst({
      where: { userId, jobId, deletedAt: null },
    });
    if (!existing) return;

    await this.prisma.savedJob.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  async listSavedJobs(userId: string, query: CursorPaginationQueryDto) {
    let cursorWhere: Prisma.SavedJobWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.createdAt);
        cursorWhere = {
          OR: [
            { createdAt: { lt: cursorDate } },
            {
              AND: [{ createdAt: cursorDate }, { id: { lt: decoded.id } }],
            },
          ],
        };
      }
    }

    const limit = query.limit ?? 20;
    const rows = await this.prisma.savedJob.findMany({
      where: { AND: [{ userId, deletedAt: null }, cursorWhere] },
      include: { job: { include: JOB_INCLUDES } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : undefined;

    return {
      data: items.map((row) => ({
        savedJobId: row.id,
        savedAt: row.createdAt,
        job: toJobResponseDto(row.job),
      })),
      meta: { nextCursor, hasMore },
    };
  }

  async recordExternalApplyClick(jobId: string, userId?: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: { id: true, applyMode: true, companyId: true },
    });
    if (!job) throw new NotFoundException('JOB_NOT_FOUND');

    if (job.applyMode === ApplyMode.INTERNAL) {
      throw new BadRequestException('INTERNAL_ONLY_NO_EXTERNAL_APPLY');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'ExternalApplyClicked',
        aggregateType: 'Job',
        aggregateId: jobId,
        payload: {
          jobId,
          companyId: job.companyId,
          userId: userId ?? null,
          occurredAt: new Date().toISOString(),
        },
      });
    });
  }
}
