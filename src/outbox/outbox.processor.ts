import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../infra/config";
import { PrismaService } from "../infra/prisma";
import { NotificationEventDto } from "../realtime/dto/notification-event.dto";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { DeadLetterService } from "./dead-letter.service";
import { validateOutboxPayload } from "./events";
import { OutboxMetrics } from "./outbox.metrics";
import { ApplicationEmailProcessor } from "./processors/application-email.processor";
import { BillingProcessor } from "./processors/billing.processor";
import { CompanySearchIndexProcessor } from "./processors/company-search-index.processor";
import { JobSearchIndexProcessor } from "./processors/job-search-index.processor";
import { MessagingProcessor } from "./processors/messaging.processor";
import { NotificationProcessor } from "./processors/notification.processor";
import { PostInteractionProcessor } from "./processors/post-interaction.processor";
import { PostSearchIndexProcessor } from "./processors/post-search-index.processor";
import { ProfileCreationProcessor } from "./processors/profile-creation.processor";
import { ProfileSearchIndexProcessor } from "./processors/profile-search-index.processor";
import { SubscriptionProcessor } from "./processors/subscription.processor";

export interface ClaimedEvent {
  id: string;
  eventType: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payload: Prisma.JsonValue;
  attempts: number;
}

const OUTBOX_DISPATCH_CONCURRENCY = 4;

@Injectable()
export class OutboxProcessor implements OnApplicationShutdown {
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly leaseTimeoutMs: number;
  private readonly processorId = randomUUID();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(DeadLetterService) private readonly deadLetter: DeadLetterService,
    @Inject(CompanySearchIndexProcessor)
    private readonly companySearchIndex: CompanySearchIndexProcessor,
    @Inject(JobSearchIndexProcessor)
    private readonly jobSearchIndex: JobSearchIndexProcessor,
    @Inject(ApplicationEmailProcessor)
    private readonly applicationEmail: ApplicationEmailProcessor,
    @Inject(NotificationProcessor)
    private readonly notification: NotificationProcessor,
    @Inject(MessagingProcessor)
    private readonly messagingProcessor: MessagingProcessor,
    @Inject(PostInteractionProcessor)
    private readonly postInteraction: PostInteractionProcessor,
    @Inject(PostSearchIndexProcessor)
    private readonly postSearchIndex: PostSearchIndexProcessor,
    @Inject(ProfileCreationProcessor)
    private readonly profileCreation: ProfileCreationProcessor,
    @Inject(ProfileSearchIndexProcessor)
    private readonly profileSearchIndex: ProfileSearchIndexProcessor,
    @Inject(BillingProcessor)
    private readonly billingProcessor: BillingProcessor,
    @Inject(SubscriptionProcessor)
    private readonly subscriptionProcessor: SubscriptionProcessor,
    @Inject(OutboxMetrics) private readonly metrics: OutboxMetrics,
    @Inject(RealtimeGateway)
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OutboxProcessor.name);
    this.batchSize = this.config.get("outboxBatchSize", { infer: true });
    this.maxRetries = this.config.get("outboxMaxRetries", { infer: true });
    this.baseBackoffMs = this.config.get("outboxBaseBackoffMs", {
      infer: true,
    });
    this.maxBackoffMs = this.config.get("outboxMaxBackoffMs", { infer: true });
    this.leaseTimeoutMs = this.config.get("outboxLeaseTimeoutMs", {
      infer: true,
    });
    this.metrics.registerPendingGauge(
      () =>
        this.prisma.outboxEvent.count({
          where: { status: "PENDING" },
        }),
      (err) => this.logger.error("Outbox pending metric failed: %s", err),
    );
  }

  @Cron(CronExpression.EVERY_5_SECONDS, {
    name: "outbox-processor",
    waitForCompletion: true,
  })
  async processOutbox(): Promise<void> {
    try {
      await this.recoverStaleLocks();
      const events = await this.claimEvents();
      if (events.length === 0) return;

      this.logger.debug("Processing %d outbox events", events.length);

      await this.processEventGroups(this.groupEventsByAggregate(events));
    } catch (err) {
      // Log but don't rethrow — that would kill the cron job
      this.logger.error("Outbox processing failed: %s", err);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.metrics.unregisterPendingGauge();
    try {
      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          status: "PROCESSING",
          lockedBy: this.processorId,
        },
        data: {
          status: "PENDING",
          lockedAt: null,
          lockedBy: null,
        },
      });
      if (result.count > 0) {
        this.logger.warn("Released %d outbox locks during shutdown", result.count);
      }
    } catch (err) {
      this.logger.error("Failed to release outbox locks during shutdown: %s", err);
    }
  }

  async claimEvents(): Promise<ClaimedEvent[]> {
    const lockId = this.processorId;

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
              locked_by = ${lockId}
          WHERE id = ANY(${ids}::uuid[])
        `;

      // 3. Fetch full rows for the handler
      const events = (await tx.outboxEvent.findMany({
        where: { id: { in: ids }, lockedBy: lockId },
        orderBy: { createdAt: "asc" },
      })) as ClaimedEvent[];
      return events;
    });
  }

  private groupEventsByAggregate(events: ClaimedEvent[]): ClaimedEvent[][] {
    const groups = new Map<string, ClaimedEvent[]>();
    for (const event of events) {
      const key = event.aggregateId
        ? `${event.aggregateType ?? "unknown"}:${event.aggregateId}`
        : event.id;
      const group = groups.get(key);
      if (group) {
        group.push(event);
      } else {
        groups.set(key, [event]);
      }
    }
    return [...groups.values()];
  }

  private async processEventGroups(groups: ClaimedEvent[][]): Promise<void> {
    let nextGroupIndex = 0;
    const workerCount = Math.min(OUTBOX_DISPATCH_CONCURRENCY, groups.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextGroupIndex < groups.length) {
          const group = groups[nextGroupIndex];
          nextGroupIndex++;
          for (const event of group) {
            await this.processClaimedEvent(event);
          }
        }
      }),
    );
  }

  private async processClaimedEvent(event: ClaimedEvent): Promise<void> {
    const dispatchStartedAt = Date.now();
    let dispatchRecorded = false;
    try {
      await this.dispatch(event);
      this.metrics.recordDispatchDuration(
        event.eventType,
        "success",
        Date.now() - dispatchStartedAt,
      );
      dispatchRecorded = true;
      await this.markProcessed(event.id);
      this.metrics.recordProcessed(event.eventType);
      this.logger.debug("Event %s (%s) marked as processed", event.id, event.eventType);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const attempts = await this.recordFailure(event.id);
      if (!dispatchRecorded) {
        this.metrics.recordDispatchDuration(
          event.eventType,
          "failure",
          Date.now() - dispatchStartedAt,
        );
      }
      this.metrics.recordFailed(event.eventType, attempts);

      if (attempts >= this.maxRetries) {
        await this.deadLetter.moveToDeadLetter(
          {
            id: event.id,
            eventType: event.eventType,
            payload: event.payload,
          },
          error,
        );
        this.metrics.recordDeadLettered(event.eventType);
        this.logger.warn("Event %s moved to dead letter after %d attempts", event.id, attempts);
      } else {
        await this.requeueWithBackoff(event.id, attempts);
        this.logger.debug(
          "Event %s requeued with backoff (attempt %d/%d)",
          event.id,
          attempts,
          this.maxRetries,
        );
      }
    }
  }

  private async dispatch(event: ClaimedEvent): Promise<void> {
    const payload = validateOutboxPayload(event.eventType, event.payload);
    switch (event.eventType) {
      case "UserRegistered":
        await this.profileCreation.processUserRegistered(
          payload as { userId: string; email: string },
        );
        return;
      case "ProfileUpdated":
        await this.profileSearchIndex.processProfileUpdated(
          payload as { profileId: string; userId: string },
        );
        return;
      case "CompanyCreated":
        await this.companySearchIndex.processCompanyCreated(payload as { companyId: string });
        await this.subscriptionProcessor.createFreeSubscription(
          (payload as { companyId: string }).companyId,
        );
        return;
      // The following events all affect the company search document
      // (member counts, member names, follower counts, recruiter seats),
      // so route them through the same reindex path. If a dedicated handler
      // is needed later, split out below.
      case "CompanyUpdated":
      case "CompanyFollowed":
      case "CompanyUnfollowed":
      case "CompanyMemberAdded":
      case "CompanyMemberRoleChanged":
      case "CompanyMemberRemoved":
      case "MemberInvited":
      case "MemberJoined":
      case "RecruiterSeatDeallocated": {
        const companyPayload = payload as { companyId?: string };
        if (!companyPayload?.companyId) {
          this.logger.warn(`${event.eventType} event ${event.id} missing companyId — skipping`);
          return;
        }
        await this.companySearchIndex.processCompanyUpdated({
          companyId: companyPayload.companyId,
        });
        return;
      }
      case "RecruiterSeatAllocated": {
        const seatPayload = payload as {
          companyId?: string;
          recruiterUserId?: string;
        };
        if (!seatPayload?.companyId) {
          this.logger.warn(`RecruiterSeatAllocated event ${event.id} missing companyId — skipping`);
          return;
        }
        // Keep existing search-index side-effect.
        await this.companySearchIndex.processCompanyUpdated({
          companyId: seatPayload.companyId,
        });
        if (seatPayload.recruiterUserId) {
          await this.notification.processRecruiterSeatAllocated({
            companyId: seatPayload.companyId,
            recruiterUserId: seatPayload.recruiterUserId,
          });
        }
        return;
      }
      case "JobCreated":
        await this.jobSearchIndex.processJobCreated(payload as { jobId: string });
        return;
      case "JobUpdated":
        await this.jobSearchIndex.processJobUpdated(payload as { jobId: string });
        return;
      case "JobPublished":
        await this.jobSearchIndex.processJobPublished(payload as { jobId: string });
        return;
      case "JobClosed":
        await this.jobSearchIndex.processJobClosed(payload as { jobId: string });
        return;
      case "JobDeleted":
        await this.jobSearchIndex.processJobDeleted(payload as { jobId: string });
        return;
      case "ApplicationSubmitted":
        await this.notification.processApplicationSubmitted(
          payload as {
            applicationId: string;
            jobId: string;
            companyId: string;
            candidateUserId: string;
          },
        );
        return;
      case "ApplicationStatusChanged":
        await this.applicationEmail.processApplicationStatusChanged(
          payload as {
            applicationId: string;
            toStatus: string;
            fromStatus?: string;
          },
        );
        await this.notification.processApplicationStatusChanged(
          payload as {
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
      case "ApplicationNoteAdded":
        await this.notification.processApplicationNoteAdded(
          payload as {
            applicationId: string;
            noteId: string;
            authorUserId: string;
            companyId: string;
          },
        );
        return;
      case "ConnectionRequested":
        await this.notification.processConnectionRequested(
          payload as {
            connectionId: string;
            requesterUserId: string;
            targetUserId: string;
          },
        );
        return;
      case "ConnectionAccepted":
        await this.notification.processConnectionAccepted(
          payload as {
            connectionId: string;
            requesterUserId: string;
            targetUserId: string;
          },
        );
        return;
      case "UserBlocked":
        await this.notification.processUserBlocked(
          payload as {
            blockerUserId: string;
            blockedUserId: string;
          },
        );
        return;
      case "ExternalApplyClicked": {
        const { jobId, companyId } = payload as {
          jobId: string;
          companyId: string;
        };
        await this.prisma.job.update({
          where: { id: jobId },
          data: { externalClickCount: { increment: 1 } },
        });
        this.logger.debug(
          `ExternalApplyClicked: tracked click for job ${jobId} (company=${companyId})`,
        );
        return;
      }
      case "CandidateSaved":
      case "CandidateAddedToTalentPool":
        // Deferred to Phase 4: notify candidate via email + in-app notification
        this.logger.debug(
          `Deferred handler for ${event.eventType} (id=${event.id}) — candidate notification in Phase 4`,
        );
        return;
      // Posts domain — Phase 6
      case "PostCreated":
        await this.postInteraction.processPostCreated(
          payload as {
            postId: string;
            authorId: string;
            visibility: string;
          },
        );
        await this.postSearchIndex.processPostCreated(payload as { postId: string });
        return;
      case "PostUpdated":
        await this.postSearchIndex.processPostUpdated(payload as { postId: string });
        return;
      case "PostContentChanged":
        await this.postSearchIndex.processPostUpdated(payload as { postId: string });
        return;
      case "PostDeleted":
        await this.postSearchIndex.processPostDeleted(payload as { postId: string });
        return;
      case "CommentAdded":
        await this.postInteraction.processCommentAdded(
          payload as {
            commentId: string;
            postId: string;
            authorId: string;
          },
        );
        return;
      case "ReactionAdded":
        await this.postInteraction.processReactionAdded(
          payload as {
            reactionId: string;
            postId: string;
            authorId: string;
            type: string;
          },
        );
        return;
      case "MentionCreated":
        await this.postInteraction.processMentionCreated(
          payload as {
            postId: string;
            mentionedUserId: string;
            mentionerUserId: string;
          },
        );
        return;
      case "MentionRemoved":
        await this.postInteraction.processMentionRemoved(
          payload as {
            postId: string;
            mentionedUserId: string;
            mentionerUserId: string;
          },
        );
        return;
      // Messaging domain — Phase 7
      case "MessageSent":
        await this.messagingProcessor.processMessageSent(
          payload as {
            messageId: string;
            conversationId: string;
            senderId: string;
            recipientIds: string[];
          },
        );
        return;
      case "ConversationCreated": {
        const convPayload = payload as {
          conversationId: string;
          participantIds: string[];
        };
        // Realtime fan-out: push notification to each participant
        for (const participantId of convPayload.participantIds) {
          const notificationEvent: NotificationEventDto = {
            id: convPayload.conversationId,
            type: "ConversationCreated",
            title: "New conversation",
            body: "A new conversation has been created",
            actionUrl: `/conversations/${convPayload.conversationId}`,
            createdAt: new Date(),
          };
          this.realtimeGateway.pushNotification(participantId, notificationEvent);
        }
        this.logger.debug(
          `ConversationCreated: conv=${convPayload.conversationId} participants=${convPayload.participantIds.length}`,
        );
        return;
      }
      case "PaymentProviderEventReceived":
        await this.billingProcessor.processPaymentProviderEvent(
          (payload as { eventId: string }).eventId,
        );
        return;
      default:
        // No handler registered yet — treat as no-op (will be marked processed).
        this.logger.debug(`No handler for event type ${event.eventType} (id=${event.id})`);
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
      this.logger.error("Stale lock recovery failed: %s", err);
    }
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  private async requeueWithBackoff(eventId: string, attempts: number): Promise<void> {
    const backoffMs = this.calculateBackoff(attempts);
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: "PENDING",
        availableAt: new Date(Date.now() + backoffMs),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  private async recordFailure(eventId: string): Promise<number> {
    const event = await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return event.attempts;
  }

  private calculateBackoff(attempt: number): number {
    const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** attempt);
    return Math.random() * exp; // Full jitter
  }
}
