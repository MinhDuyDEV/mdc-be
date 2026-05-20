import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma';
import { DeadLetterService } from './dead-letter.service';
import { ApplicationEmailProcessor } from './processors/application-email.processor';
import { CompanySearchIndexProcessor } from './processors/company-search-index.processor';
import { JobSearchIndexProcessor } from './processors/job-search-index.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { PostInteractionProcessor } from './processors/post-interaction.processor';

export interface ClaimedEvent {
  id: string;
  eventType: string;
  payload: unknown;
  attempts: number;
}

@Injectable()
export class OutboxProcessor {
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly leaseTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly deadLetter: DeadLetterService,
    private readonly companySearchIndex: CompanySearchIndexProcessor,
    private readonly jobSearchIndex: JobSearchIndexProcessor,
    private readonly applicationEmail: ApplicationEmailProcessor,
    private readonly notification: NotificationProcessor,
    private readonly postInteraction: PostInteractionProcessor,
    @InjectPinoLogger(OutboxProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    this.batchSize = this.config.get('outboxBatchSize', { infer: true });
    this.maxRetries = this.config.get('outboxMaxRetries', { infer: true });
    this.baseBackoffMs = this.config.get('outboxBaseBackoffMs', {
      infer: true,
    });
    this.maxBackoffMs = this.config.get('outboxMaxBackoffMs', { infer: true });
    this.leaseTimeoutMs = this.config.get('outboxLeaseTimeoutMs', {
      infer: true,
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS, {
    name: 'outbox-processor',
    waitForCompletion: true,
  })
  async processOutbox(): Promise<void> {
    try {
      await this.recoverStaleLocks();
      const events = await this.claimEvents();
      if (events.length === 0) return;

      this.logger.debug('Processing %d outbox events', events.length);

      for (const event of events) {
        try {
          await this.dispatch(event);
          await this.markProcessed(event.id);
          this.logger.debug(
            'Event %s (%s) marked as processed',
            event.id,
            event.eventType,
          );
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          const attempts = await this.getAttempts(event.id);

          if (attempts >= this.maxRetries) {
            await this.deadLetter.moveToDeadLetter(
              {
                id: event.id,
                eventType: event.eventType,
                payload: event.payload,
              },
              error,
            );
            this.logger.warn(
              'Event %s moved to dead letter after %d attempts',
              event.id,
              attempts,
            );
          } else {
            await this.requeueWithBackoff(event.id, attempts);
            this.logger.debug(
              'Event %s requeued with backoff (attempt %d/%d)',
              event.id,
              attempts,
              this.maxRetries,
            );
          }
        }
      }
    } catch (err) {
      // Log but don't rethrow — that would kill the cron job
      this.logger.error('Outbox processing failed: %s', err);
    }
  }

  async claimEvents(): Promise<ClaimedEvent[]> {
    const lockId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // 1. Atomically lock pending rows with SKIP LOCKED
      const claimed: Array<{ id: string }> = await tx.$queryRaw`
        SELECT id FROM outbox_events
        WHERE status = 'PENDING'::"OutboxEventStatus"
          AND available_at <= NOW()
        ORDER BY available_at ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (claimed.length === 0) return [];

      const ids = claimed.map((r) => r.id);

      // 2. Mark as PROCESSING
      await tx.$executeRaw`
        UPDATE outbox_events
        SET status = 'PROCESSING'::"OutboxEventStatus",
            locked_at = NOW(),
            locked_by = ${lockId},
            attempts = attempts + 1
        WHERE id = ANY(${ids}::uuid[])
      `;

      // 3. Fetch full rows for the handler
      const events = (await tx.outboxEvent.findMany({
        where: { id: { in: ids }, lockedBy: lockId },
        orderBy: { createdAt: 'asc' },
      })) as ClaimedEvent[];
      return events;
    });
  }

  private async dispatch(event: ClaimedEvent): Promise<void> {
    switch (event.eventType) {
      case 'CompanyCreated':
        await this.companySearchIndex.processCompanyCreated(
          event.payload as { companyId: string },
        );
        return;
      case 'CompanyUpdated':
      // The following events all affect the company search document
      // (member counts, member names, follower counts, recruiter seats),
      // so route them through the same reindex path. If a dedicated handler
      // is needed later, split out below.
      // eslint-disable-next-line no-fallthrough
      case 'CompanyFollowed':
      case 'CompanyUnfollowed':
      case 'CompanyMemberAdded':
      case 'CompanyMemberRoleChanged':
      case 'CompanyMemberRemoved':
      case 'MemberInvited':
      case 'MemberJoined':
      case 'RecruiterSeatDeallocated': {
        const payload = event.payload as { companyId?: string };
        if (!payload?.companyId) {
          this.logger.warn(
            `${event.eventType} event ${event.id} missing companyId — skipping`,
          );
          return;
        }
        await this.companySearchIndex.processCompanyUpdated({
          companyId: payload.companyId,
        });
        return;
      }
      case 'RecruiterSeatAllocated': {
        const payload = event.payload as {
          companyId?: string;
          recruiterUserId?: string;
        };
        if (!payload?.companyId) {
          this.logger.warn(
            `RecruiterSeatAllocated event ${event.id} missing companyId — skipping`,
          );
          return;
        }
        // Keep existing search-index side-effect.
        await this.companySearchIndex.processCompanyUpdated({
          companyId: payload.companyId,
        });
        if (payload.recruiterUserId) {
          await this.notification.processRecruiterSeatAllocated({
            companyId: payload.companyId,
            recruiterUserId: payload.recruiterUserId,
          });
        }
        return;
      }
      case 'JobCreated':
        await this.jobSearchIndex.processJobCreated(
          event.payload as { jobId: string },
        );
        return;
      case 'JobUpdated':
        await this.jobSearchIndex.processJobUpdated(
          event.payload as { jobId: string },
        );
        return;
      case 'JobPublished':
        await this.jobSearchIndex.processJobPublished(
          event.payload as { jobId: string },
        );
        return;
      case 'JobClosed':
        await this.jobSearchIndex.processJobClosed(
          event.payload as { jobId: string },
        );
        return;
      case 'JobDeleted':
        await this.jobSearchIndex.processJobDeleted(
          event.payload as { jobId: string },
        );
        return;
      case 'ApplicationSubmitted':
        await this.notification.processApplicationSubmitted(
          event.payload as {
            applicationId: string;
            jobId: string;
            companyId: string;
            candidateUserId: string;
          },
        );
        return;
      case 'ApplicationStatusChanged':
        await this.applicationEmail.processApplicationStatusChanged(
          event.payload as {
            applicationId: string;
            toStatus: string;
            fromStatus?: string;
          },
        );
        await this.notification.processApplicationStatusChanged(
          event.payload as {
            applicationId: string;
            fromStatus?: string;
            toStatus: string;
            companyId: string;
            candidateUserId: string;
            changedByUserId?: string;
            reason?: string | null;
          },
        );
        return;
      case 'ApplicationNoteAdded':
        await this.notification.processApplicationNoteAdded(
          event.payload as {
            applicationId: string;
            noteId: string;
            authorUserId: string;
            companyId: string;
          },
        );
        return;
      case 'ConnectionRequested':
        await this.notification.processConnectionRequested(
          event.payload as {
            connectionId: string;
            requesterUserId: string;
            targetUserId: string;
          },
        );
        return;
      case 'ConnectionAccepted':
        await this.notification.processConnectionAccepted(
          event.payload as {
            connectionId: string;
            requesterUserId: string;
            targetUserId: string;
          },
        );
        return;
      case 'UserBlocked':
        await this.notification.processUserBlocked(
          event.payload as {
            blockerUserId: string;
            blockedUserId: string;
          },
        );
        return;
      // Phase 4 stub remainder — real handlers deferred to later phases.
      case 'ExternalApplyClicked':
      case 'CandidateSaved':
      case 'CandidateAddedToTalentPool':
        this.logger.debug(
          `Phase 4 stub handler for event type ${event.eventType} (id=${event.id})`,
        );
        return;
      // Posts domain — Phase 6
      case 'PostCreated':
        await this.postInteraction.processPostCreated(
          event.payload as {
            postId: string;
            authorId: string;
            visibility: string;
          },
        );
        return;
      case 'CommentAdded':
        await this.postInteraction.processCommentAdded(
          event.payload as {
            commentId: string;
            postId: string;
            authorId: string;
          },
        );
        return;
      case 'ReactionAdded':
        await this.postInteraction.processReactionAdded(
          event.payload as {
            reactionId: string;
            postId: string;
            authorId: string;
            type: string;
          },
        );
        return;
      case 'MentionCreated':
        await this.postInteraction.processMentionCreated(
          event.payload as {
            postId: string;
            mentionedUserId: string;
            mentionerUserId: string;
          },
        );
        return;
      default:
        // No handler registered yet — treat as no-op (will be marked processed).
        this.logger.debug(
          `No handler for event type ${event.eventType} (id=${event.id})`,
        );
        return;
    }
  }

  private async recoverStaleLocks(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE outbox_events
        SET status = 'PENDING'::"OutboxEventStatus",
            locked_at = NULL,
            locked_by = NULL
        WHERE status = 'PROCESSING'::"OutboxEventStatus"
          AND locked_at < NOW() - INTERVAL '1 millisecond' * ${this.leaseTimeoutMs}
      `;
    } catch (err) {
      this.logger.error('Stale lock recovery failed: %s', err);
    }
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  private async requeueWithBackoff(
    eventId: string,
    attempts: number,
  ): Promise<void> {
    const backoffMs = this.calculateBackoff(attempts);
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PENDING',
        availableAt: new Date(Date.now() + backoffMs),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  private async getAttempts(eventId: string): Promise<number> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id: eventId },
      select: { attempts: true },
    });
    return event?.attempts ?? 0;
  }

  private calculateBackoff(attempt: number): number {
    const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** attempt);
    return Math.random() * exp; // Full jitter
  }
}
