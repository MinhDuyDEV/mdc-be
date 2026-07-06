import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  JobStatus,
  ScreeningQuestionType,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  type ApplicationStatusActor,
  evaluateTransition,
  isTerminal,
} from './application-status.machine';
import {
  type ApplicationAudience,
  toApplicationResponseDto,
} from './dto/application.response.dto';
import type { CreateApplicationNoteDto } from './dto/application-note.dto';
import type {
  SubmitApplicationDto,
  ScreeningAnswerDto,
} from './dto/submit-application.dto';
import type { UpdateApplicationStatusDto } from './dto/update-status.dto';
import type { UpdateApplicationDto } from './dto/update-application.dto';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';

const APPLICATION_INCLUDES = {
  answers: true,
  attachments: true,
  statusEvents: { orderBy: { createdAt: 'desc' as const } },
} as const;

const APPLICATION_INCLUDES_WITH_NOTES = {
  ...APPLICATION_INCLUDES,
  notes: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

/**
 * Applications domain service.
 *
 * Authorization model:
 * - Candidate scope: routes that operate on the caller's own application.
 * - Employer scope: routes guarded by company role check (OWNER, ADMIN, or
 *   active RecruiterSeat). Resolved from `Job.companyId`, not from a route
 *   :companyId param.
 *
 * DTO whitelisting: the response mapper takes an `audience` flag so the same
 * service method can be reused safely. Notes are stripped for `candidate`.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Resolves the caller's relationship to the company that owns the job:
   *  - returns 'employer' if OWNER/ADMIN/active RecruiterSeat,
   *  - returns 'none' otherwise (caller may still be a candidate).
   */
  private async resolveEmployerRole(
    companyId: string,
    userId: string,
  ): Promise<'employer' | 'none'> {
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (member && member.status === 'active') {
      const role = member.role;
      if (role === 'OWNER' || role === 'ADMIN') return 'employer';
    }
    const seat = await this.prisma.recruiterSeat.findFirst({
      where: { companyId, userId, status: 'allocated' },
    });
    if (seat) return 'employer';
    return 'none';
  }

  /**
   * Validates submitted screening answers against the job's question
   * definitions. Returns the canonical answer rows to persist (question
   * text taken from the definition, not the client).
   *
   * Rules:
   *  - every answer's `questionId` must reference a question on the job;
   *  - required questions must be answered;
   *  - answer shape must match the question `type`:
   *      TEXT         → non-empty string
   *      BOOLEAN      → exactly 'true' or 'false'
   *      SINGLE_CHOICE→ one of the question's options
   *      MULTI_CHOICE → comma-separated subset of the question's options
   *      NUMERIC      → a parseable number
   */
  private validateScreeningAnswers(
    questions: Array<{
      id: string;
      question: string;
      type: ScreeningQuestionType;
      required: boolean;
      options: string[];
    }>,
    answers: ScreeningAnswerDto[] | undefined,
  ): Array<{ questionId: string; question: string; answer: string }> {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const answered = new Map((answers ?? []).map((a) => [a.questionId, a]));
    const result: Array<{
      questionId: string;
      question: string;
      answer: string;
    }> = [];

    for (const q of questions) {
      const a = answered.get(q.id);
      if (!a) {
        if (q.required) {
          throw new BadRequestException('SCREENING_ANSWER_REQUIRED');
        }
        continue; // optional, unanswered — skip
      }
      this.validateAnswerValue(q.type, q.options, a.answer);
      result.push({
        questionId: q.id,
        question: q.question,
        answer: a.answer,
      });
    }

    // Reject answers for questions that don't exist on this job.
    for (const a of answers ?? []) {
      if (!byId.has(a.questionId)) {
        throw new BadRequestException('UNKNOWN_SCREENING_QUESTION');
      }
    }

    return result;
  }

  private validateAnswerValue(
    type: ScreeningQuestionType,
    options: string[],
    answer: string,
  ): void {
    switch (type) {
      case ScreeningQuestionType.TEXT:
        if (answer.trim() === '') {
          throw new BadRequestException('SCREENING_ANSWER_EMPTY');
        }
        return;
      case ScreeningQuestionType.BOOLEAN:
        if (answer !== 'true' && answer !== 'false') {
          throw new BadRequestException('SCREENING_ANSWER_INVALID_BOOLEAN');
        }
        return;
      case ScreeningQuestionType.SINGLE_CHOICE:
        if (!options.includes(answer)) {
          throw new BadRequestException('SCREENING_ANSWER_INVALID_OPTION');
        }
        return;
      case ScreeningQuestionType.MULTI_CHOICE: {
        const vals = answer
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (vals.length === 0) {
          throw new BadRequestException('SCREENING_ANSWER_EMPTY');
        }
        for (const v of vals) {
          if (!options.includes(v)) {
            throw new BadRequestException('SCREENING_ANSWER_INVALID_OPTION');
          }
        }
        return;
      }
      case ScreeningQuestionType.NUMERIC:
        if (Number.isNaN(Number(answer))) {
          throw new BadRequestException('SCREENING_ANSWER_INVALID_NUMERIC');
        }
        return;
    }
  }

  /**
   * Loads + verifies ownership of a resume media asset before attaching it
   * to an application. Throws `400` with a specific code on any failure.
   */
  private async assertResumeAsset(userId: string, mediaAssetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      select: { id: true, ownerId: true, purpose: true, status: true },
    });
    if (!asset || asset.ownerId !== userId) {
      throw new BadRequestException('RESUME_NOT_FOUND_OR_FOREIGN');
    }
    if (asset.purpose !== 'resume') {
      throw new BadRequestException('RESUME_WRONG_PURPOSE');
    }
    if (asset.status !== 'READY') {
      throw new BadRequestException('RESUME_NOT_READY');
    }
  }

  async submitApplication(
    userId: string,
    jobId: string,
    dto: SubmitApplicationDto,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: {
        id: true,
        status: true,
        applyMode: true,
        companyId: true,
        requireResume: true,
        screeningQuestions: {
          select: {
            id: true,
            question: true,
            type: true,
            required: true,
            options: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException('JOB_NOT_FOUND');
    if (job.status !== JobStatus.PUBLISHED) {
      throw new BadRequestException('JOB_NOT_OPEN_FOR_APPLICATIONS');
    }
    if (job.applyMode === 'EXTERNAL') {
      throw new BadRequestException('EXTERNAL_ONLY_NO_INTERNAL_APPLICATION');
    }

    // Recruiter-cannot-apply-to-own-company guard
    const employerRole = await this.resolveEmployerRole(job.companyId, userId);
    if (employerRole === 'employer') {
      throw new ForbiddenException('RECRUITER_CANNOT_APPLY_TO_OWN_COMPANY');
    }

    // Per-job resume requirement.
    if (job.requireResume && !dto.resumeMediaAssetId) {
      throw new BadRequestException('RESUME_REQUIRED');
    }

    // Validate screening answers against the job's question definitions.
    const validatedAnswers = this.validateScreeningAnswers(
      job.screeningQuestions,
      dto.screeningAnswers,
    );

    // Verify resume asset belongs to candidate, has purpose='resume', status='READY'
    if (dto.resumeMediaAssetId) {
      await this.assertResumeAsset(userId, dto.resumeMediaAssetId);
    }

    // Idempotent return: if active application already exists, return it.
    // Pre-check outside tx to avoid unnecessary idempotency key claim.
    const existing = await this.prisma.application.findFirst({
      where: {
        userId,
        jobId,
        status: {
          notIn: [ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
        },
      },
      include: APPLICATION_INCLUDES,
    });
    if (existing) {
      return toApplicationResponseDto(existing, { audience: 'candidate' });
    }

    return this.prisma.$transaction(async (tx) => {
      const idemKey = `${userId}:${jobId}`;
      await this.idempotencyService.claim(tx, 'Application:submit', idemKey);

      const created = await tx.application.create({
        data: {
          jobId,
          userId,
          status: ApplicationStatus.SUBMITTED,
          coverLetter: dto.coverLetter ?? null,
          resumeMediaAssetId: dto.resumeMediaAssetId ?? null,
          idempotencyKey: idemKey,
          ...(validatedAnswers.length
            ? {
                answers: {
                  create: validatedAnswers.map((a) => ({
                    questionId: a.questionId,
                    question: a.question,
                    answer: a.answer,
                  })),
                },
              }
            : {}),
          ...(dto.resumeMediaAssetId
            ? {
                attachments: {
                  create: [
                    { mediaAssetId: dto.resumeMediaAssetId, kind: 'resume' },
                  ],
                },
              }
            : {}),
        },
        include: APPLICATION_INCLUDES,
      });

      // Initial status event (system-generated)
      await tx.applicationStatusEvent.create({
        data: {
          applicationId: created.id,
          fromStatus: null,
          toStatus: ApplicationStatus.SUBMITTED,
          changedByUserId: userId,
          reason: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'application.submit',
          entityType: 'Application',
          entityId: created.id,
          metadata: { jobId, companyId: job.companyId },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'ApplicationSubmitted',
        aggregateType: 'Application',
        aggregateId: created.id,
        payload: {
          applicationId: created.id,
          jobId,
          companyId: job.companyId,
          candidateUserId: userId,
        },
      });

      // Reload with updated statusEvents
      const reloaded = await tx.application.findUnique({
        where: { id: created.id },
        include: APPLICATION_INCLUDES,
      });
      return toApplicationResponseDto(reloaded ?? created, {
        audience: 'candidate',
      });
    });
  }

  async listMyApplications(
    userId: string,
    query: { cursor?: string; limit?: number },
  ) {
    const limit = query.limit ?? 20;
    let cursorWhere: Prisma.ApplicationWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = {
          OR: [
            { submittedAt: { lt: decoded.createdAt } },
            {
              AND: [
                { submittedAt: decoded.createdAt },
                { id: { lt: decoded.id } },
              ],
            },
          ],
        };
      }
    }

    const rows = await this.prisma.application.findMany({
      where: { AND: [{ userId }, cursorWhere] },
      include: APPLICATION_INCLUDES,
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor(last.submittedAt, last.id) : undefined;

    return {
      data: items.map((row) =>
        toApplicationResponseDto(row, { audience: 'candidate' }),
      ),
      meta: { nextCursor, hasMore },
    };
  }

  async listEmployerApplications(
    userId: string,
    jobId: string,
    query: { cursor?: string; limit?: number },
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!job) throw new NotFoundException('JOB_NOT_FOUND');

    const employerRole = await this.resolveEmployerRole(job.companyId, userId);
    if (employerRole !== 'employer') {
      throw new ForbiddenException('INSUFFICIENT_COMPANY_ROLE');
    }

    const limit = query.limit ?? 20;
    let cursorWhere: Prisma.ApplicationWhereInput = {};
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = {
          OR: [
            { submittedAt: { lt: decoded.createdAt } },
            {
              AND: [
                { submittedAt: decoded.createdAt },
                { id: { lt: decoded.id } },
              ],
            },
          ],
        };
      }
    }

    const rows = await this.prisma.application.findMany({
      where: { AND: [{ jobId }, cursorWhere] },
      include: APPLICATION_INCLUDES_WITH_NOTES,
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor(last.submittedAt, last.id) : undefined;

    return {
      data: items.map((row) =>
        toApplicationResponseDto(row, { audience: 'employer' }),
      ),
      meta: { nextCursor, hasMore },
    };
  }

  /**
   * Loads the application + verifies the caller can see it.
   * Returns both the application row and the audience flag derived from the
   * caller's relationship to the company.
   */
  private async loadApplicationWithAudience(
    userId: string,
    applicationId: string,
  ) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } } },
    });
    if (!app) throw new NotFoundException('APPLICATION_NOT_FOUND');

    const isCandidate = app.userId === userId;
    const employerRole = await this.resolveEmployerRole(
      app.job.companyId,
      userId,
    );

    if (!isCandidate && employerRole !== 'employer') {
      // Avoid existence oracle — same 404 as not-found.
      throw new NotFoundException('APPLICATION_NOT_FOUND');
    }

    const audience: ApplicationAudience =
      employerRole === 'employer' ? 'employer' : 'candidate';
    return { app, audience, isCandidate, companyId: app.job.companyId };
  }

  async getApplication(userId: string, applicationId: string) {
    const { audience, companyId } = await this.loadApplicationWithAudience(
      userId,
      applicationId,
    );
    const includes =
      audience === 'employer'
        ? APPLICATION_INCLUDES_WITH_NOTES
        : APPLICATION_INCLUDES;
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: includes,
    });
    if (!app) throw new NotFoundException('APPLICATION_NOT_FOUND');
    void companyId; // referenced via permission check above
    return toApplicationResponseDto(app, { audience });
  }

  async updateStatus(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const { app, isCandidate, companyId } =
      await this.loadApplicationWithAudience(userId, applicationId);

    const actor: ApplicationStatusActor = isCandidate
      ? 'candidate'
      : 'recruiter';

    const decision = evaluateTransition(app.status, dto.newStatus, actor);
    if (!decision.ok) {
      if (decision.reason === 'APPLICATION_TERMINAL') {
        throw new BadRequestException('APPLICATION_TERMINAL');
      }
      if (decision.reason === 'INSUFFICIENT_ACTOR_ROLE') {
        throw new ForbiddenException('INSUFFICIENT_ACTOR_ROLE');
      }
      // INVALID_STATUS_TRANSITION
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        from: app.status,
        to: dto.newStatus,
        allowed: decision.allowed ?? [],
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const idemKey = `${applicationId}:${dto.newStatus}`;
      await this.idempotencyService.claim(tx, 'Application:status', idemKey);

      const updateData: Prisma.ApplicationUpdateInput = {
        status: dto.newStatus,
      };
      if (dto.newStatus === ApplicationStatus.WITHDRAWN) {
        updateData.withdrawnAt = new Date();
      }

      await tx.application.update({
        where: { id: applicationId },
        data: updateData,
      });

      await tx.applicationStatusEvent.create({
        data: {
          applicationId,
          fromStatus: app.status,
          toStatus: dto.newStatus,
          changedByUserId: userId,
          reason: dto.reason ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'application.status.update',
          entityType: 'Application',
          entityId: applicationId,
          metadata: {
            fromStatus: app.status,
            toStatus: dto.newStatus,
            companyId,
          },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'ApplicationStatusChanged',
        aggregateType: 'Application',
        aggregateId: applicationId,
        payload: {
          applicationId,
          fromStatus: app.status,
          toStatus: dto.newStatus,
          companyId,
          candidateUserId: app.userId,
          changedByUserId: userId,
          reason: dto.reason ?? null,
        },
      });

      const reloaded = await tx.application.findUnique({
        where: { id: applicationId },
        include: isCandidate
          ? APPLICATION_INCLUDES
          : APPLICATION_INCLUDES_WITH_NOTES,
      });
      if (!reloaded) throw new NotFoundException('APPLICATION_NOT_FOUND');
      return toApplicationResponseDto(reloaded, {
        audience: isCandidate ? 'candidate' : 'employer',
      });
    });
  }

  async withdraw(userId: string, applicationId: string) {
    const { app, isCandidate } = await this.loadApplicationWithAudience(
      userId,
      applicationId,
    );
    if (!isCandidate) {
      throw new ForbiddenException('INSUFFICIENT_ACTOR_ROLE');
    }
    if (isTerminal(app.status)) {
      throw new BadRequestException('APPLICATION_TERMINAL');
    }
    return this.updateStatus(userId, applicationId, {
      newStatus: ApplicationStatus.WITHDRAWN,
    });
  }

  /**
   * Candidate-only edit of a submitted application. Allowed only while the
   * application is in a pre-terminal status (SUBMITTED / REVIEWED /
   * INTERVIEWING / OFFER). Swapping the resume also replaces the resume
   * attachment row.
   */
  async updateApplication(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationDto,
  ) {
    const { app, isCandidate } = await this.loadApplicationWithAudience(
      userId,
      applicationId,
    );
    if (!isCandidate) {
      throw new ForbiddenException('INSUFFICIENT_ACTOR_ROLE');
    }
    if (isTerminal(app.status)) {
      throw new BadRequestException('APPLICATION_TERMINAL');
    }

    if (dto.resumeMediaAssetId !== undefined && dto.resumeMediaAssetId) {
      await this.assertResumeAsset(userId, dto.resumeMediaAssetId);
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.ApplicationUpdateInput = {};
      if (dto.coverLetter !== undefined) {
        data.coverLetter = dto.coverLetter;
      }
      if (dto.resumeMediaAssetId !== undefined && dto.resumeMediaAssetId) {
        data.resumeMediaAsset = { connect: { id: dto.resumeMediaAssetId } };
        await tx.applicationAttachment.deleteMany({
          where: { applicationId, kind: 'resume' },
        });
        await tx.applicationAttachment.create({
          data: {
            applicationId,
            mediaAssetId: dto.resumeMediaAssetId,
            kind: 'resume',
          },
        });
      }

      await tx.application.update({ where: { id: applicationId }, data });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'application.update',
          entityType: 'Application',
          entityId: applicationId,
          metadata: {
            coverLetterChanged: dto.coverLetter !== undefined,
            resumeChanged: dto.resumeMediaAssetId !== undefined,
          },
        },
      });

      const reloaded = await tx.application.findUnique({
        where: { id: applicationId },
        include: APPLICATION_INCLUDES,
      });
      if (!reloaded) throw new NotFoundException('APPLICATION_NOT_FOUND');
      return toApplicationResponseDto(reloaded, { audience: 'candidate' });
    });
  }

  async addNote(
    userId: string,
    applicationId: string,
    dto: CreateApplicationNoteDto,
  ) {
    const { isCandidate, companyId } = await this.loadApplicationWithAudience(
      userId,
      applicationId,
    );
    if (isCandidate) {
      throw new ForbiddenException('NOTES_EMPLOYER_ONLY');
    }

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.applicationNote.create({
        data: {
          applicationId,
          authorUserId: userId,
          content: dto.content,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'application.note.add',
          entityType: 'ApplicationNote',
          entityId: note.id,
          metadata: { applicationId, companyId },
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'ApplicationNoteAdded',
        aggregateType: 'Application',
        aggregateId: applicationId,
        payload: {
          applicationId,
          noteId: note.id,
          authorUserId: userId,
          companyId,
        },
      });

      return {
        id: note.id,
        applicationId: note.applicationId,
        authorUserId: note.authorUserId,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      };
    });
  }

  async listNotes(userId: string, applicationId: string) {
    const { isCandidate } = await this.loadApplicationWithAudience(
      userId,
      applicationId,
    );
    if (isCandidate) {
      throw new ForbiddenException('NOTES_EMPLOYER_ONLY');
    }
    const notes = await this.prisma.applicationNote.findMany({
      where: { applicationId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
    });
    return notes.map((n) => ({
      id: n.id,
      applicationId: n.applicationId,
      authorUserId: n.authorUserId,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
  }

  /**
   * Returns metadata for the resume MediaAsset attached to the application.
   * The presigned URL itself is generated by MediaService.getDownloadUrl
   * which already enforces ownership; here we audit-log access AND surface
   * the mediaAssetId so the controller can hand it off to MediaService.
   *
   * Both candidate (own application) AND employer can request this. Each
   * request appends an AuditLog entry — deferred to the controller/service
   * boundary in this service via auditLog.create directly.
   */
  async getResumeAccess(userId: string, applicationId: string) {
    const { app, audience, companyId } = await this.loadApplicationWithAudience(
      userId,
      applicationId,
    );
    if (!app.resumeMediaAssetId) {
      throw new NotFoundException('RESUME_NOT_ATTACHED');
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'application.resume.access',
        entityType: 'Application',
        entityId: applicationId,
        metadata: {
          mediaAssetId: app.resumeMediaAssetId,
          audience,
          companyId,
        },
      },
    });

    return {
      applicationId,
      mediaAssetId: app.resumeMediaAssetId,
      // The controller delegates to MediaService.getDownloadUrl. Because the
      // resume might belong to the candidate, we expose the candidate's user
      // id so the controller can ensure MediaService is called with proper
      // ownership context (or use a service-trust boundary).
      ownerUserId: app.userId,
    };
  }
}
