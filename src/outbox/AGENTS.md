<!-- Parent: ../AGENTS.md -->

# Outbox Module

## Purpose

The Outbox module implements the transactional outbox pattern for reliable event emission and asynchronous processing. It ensures domain events are atomically committed with database transactions and processed asynchronously with retry, exponential backoff, dead-letter handling, and idempotency guarantees.

**Key responsibilities:**
- Provide transactional event emission API (OutboxService.emit)
- Process events asynchronously with claim-based concurrency (SKIP LOCKED)
- Route events to domain-specific processors (notifications, search indexing, emails)
- Implement retry with exponential backoff and full jitter
- Move failed events to dead-letter queue after max retries
- Recover stale locks from crashed processors
- Prevent duplicate operations with idempotency keys
- Emit Prometheus metrics for monitoring

## Key Files

### Core Services

- **outbox.service.ts** - Event emission API (must be called inside transactions)
  - `emit()` - Creates PENDING outbox event with payload validation

- **outbox.processor.ts** - Background cron job for event processing
  - `processOutbox()` - Main loop (runs every 5 seconds)
  - `claimEvents()` - Atomically claims PENDING events with SKIP LOCKED
  - `dispatch()` - Routes events to domain-specific processors
  - `processClaimedEvent()` - Processes single event with retry/dead-letter handling
  - `recoverStaleLocks()` - Releases events locked longer than leaseTimeoutMs
  - `groupEventsByAggregate()` - Groups events by aggregateId for ordered processing
  - `processEventGroups()` - Processes event groups with concurrency limit (4 workers)

- **idempotency.service.ts** - Idempotency key management
  - `claim()` - Claims idempotency key (throws on duplicate)
  - `cleanup()` - Removes expired keys (runs hourly with leader lock)

- **dead-letter.service.ts** - Dead letter queue for failed events
  - `moveToDeadLetter()` - Moves event to dead_letter_events table
  - `replay()` - Replays dead-letter event as new PENDING event

### Metrics

- **outbox.metrics.ts** - Prometheus metrics for monitoring
  - `outbox_pending_total` - Gauge of PENDING events
  - `outbox_processed_total` - Counter of processed events (by eventType)
  - `outbox_failed_total` - Counter of failed events (by eventType, attempts)
  - `outbox_dead_lettered_total` - Counter of dead-lettered events (by eventType)
  - `outbox_dispatch_duration_seconds` - Histogram of dispatch duration (by eventType, status)

### Configuration

- **outbox-core.module.ts** - Core module with OutboxService and IdempotencyService
- **outbox-processor.module.ts** - Processor module with OutboxProcessor and event processors
- **outbox.module.ts** - Backward-compatible alias for OutboxCoreModule
- **outbox.constants.ts** - Constants for event types and configuration
- **outbox.types.ts** - TypeScript types for outbox events

## Subdirectories

### events/

Event schema registry and validation:
- **event-schema.registry.ts** - Zod schemas for all 40+ event types
  - `outboxEventSchemas` - Map of eventType → Zod schema
  - `validateOutboxPayload()` - Validates payload against schema
  - `isOutboxEventType()` - Type guard for event types

### processors/

Domain-specific event processors (18 processors):
- **profile-creation.processor.ts** - UserRegistered → create default profile
- **profile-search-index.processor.ts** - ProfileUpdated → reindex in Typesense
- **company-search-index.processor.ts** - Company events → reindex in Typesense
- **job-search-index.processor.ts** - Job events → reindex in Typesense
- **post-search-index.processor.ts** - Post events → reindex in Typesense
- **post-interaction.processor.ts** - Comment/reaction/mention → create notifications
- **notification.processor.ts** - Application/connection/recruiting events → create notifications
- **messaging.processor.ts** - MessageSent → create notifications
- **application-email.processor.ts** - ApplicationStatusChanged → send email
- **billing.processor.ts** - PaymentProviderEventReceived → process Stripe webhooks
- **subscription.processor.ts** - CompanyCreated → create free subscription

## For AI Agents

### Working with Outbox

**Event emission (domain modules):**
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Perform domain operation
  const post = await tx.post.create({ data: { ... } });

  // 2. Emit event in same transaction
  await this.outboxService.emit(tx, {
    eventType: 'PostCreated',
    aggregateType: 'Post',
    aggregateId: post.id,
    payload: { postId: post.id, authorId: post.authorId, visibility: post.visibility },
  });
});
```

**Event processing flow:**
1. OutboxProcessor runs every 5 seconds via @Cron
2. Processor recovers stale locks (locked > leaseTimeoutMs)
3. Processor claims batch of PENDING events with SKIP LOCKED
4. Processor groups events by aggregateId for ordered processing
5. Processor dispatches events to domain processors with 4-worker concurrency
6. On success: mark PROCESSED, record metrics
7. On failure: increment attempts, requeue with backoff, or move to dead-letter

**Retry strategy:**
- Exponential backoff: `min(maxBackoffMs, baseBackoffMs * 2^attempt)`
- Full jitter: `random(0, backoff)`
- Max retries: configurable (default: 5)
- After max retries: move to dead-letter queue

**Idempotency:**
```typescript
// Prevent duplicate operations
await this.idempotencyService.claim('Conversation:create', canonicalKey);
// Throws ConflictException if key already exists
```

### Testing Requirements

**Unit tests must cover:**
- OutboxService.emit validates payload against schema
- OutboxService.emit throws error when called outside transaction
- OutboxProcessor claims events with SKIP LOCKED (no duplicate processing)
- Event grouping by aggregateId (ordered processing)
- Retry with exponential backoff and jitter
- Dead-letter handling after max retries
- Stale lock recovery for events locked too long
- Event routing to correct processors
- Idempotency key enforcement (duplicate claims throw ConflictException)

**Integration tests must verify:**
- Full event flow (emit → process → mark processed)
- Concurrent processing (multiple processors, no duplicate work)
- Retry behavior (failed events requeued with backoff)
- Dead-letter queue (events moved after max retries)
- Stale lock recovery (events released after timeout)
- Metrics emission (counters, gauges, histograms)
- Leader lock for cleanup jobs

### Common Patterns

**Atomic event emission:**
```typescript
await this.prisma.$transaction(async (tx) => {
  const entity = await tx.entity.create({ ... });
  await this.outboxService.emit(tx, {
    eventType: 'EntityCreated',
    aggregateType: 'Entity',
    aggregateId: entity.id,
    payload: { entityId: entity.id, ... },
  });
});
```

**Event processor implementation:**
```typescript
@Injectable()
export class MyProcessor {
  async processMyEvent(payload: MyEventPayload): Promise<void> {
    // Idempotent processing logic
    // Throws on failure (will be retried)
  }
}
```

**Claim events with SKIP LOCKED:**
```typescript
await this.prisma.$transaction(async (tx) => {
  const claimed = await tx.$queryRaw`
    SELECT id FROM outbox_events
    WHERE status = 'PENDING' AND available_at <= NOW()
    ORDER BY available_at ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  `;
  
  await tx.$executeRaw`
    UPDATE outbox_events
    SET status = 'PROCESSING', locked_at = NOW(), locked_by = ${lockId}
    WHERE id = ANY(${ids}::uuid[])
  `;
  
  return tx.outboxEvent.findMany({ where: { id: { in: ids } } });
});
```

### Event Types (40+ events)

**User & Profile:**
- UserRegistered, UserLoggedIn, ProfileUpdated, UserBlocked

**Company:**
- CompanyCreated, CompanyUpdated, CompanyFollowed, CompanyUnfollowed
- CompanyMemberAdded, CompanyMemberRemoved, CompanyMemberRoleChanged
- MemberInvited, MemberJoined

**Jobs & Applications:**
- JobCreated, JobUpdated, JobPublished, JobClosed, JobDeleted
- ApplicationSubmitted, ApplicationStatusChanged, ApplicationNoteAdded
- ExternalApplyClicked, CandidateSaved, CandidateAddedToTalentPool

**Recruiting:**
- RecruiterSeatAllocated, RecruiterSeatDeallocated

**Connections:**
- ConnectionRequested, ConnectionAccepted

**Posts:**
- PostCreated, PostUpdated, PostDeleted
- CommentAdded, ReactionAdded, ReactionRemoved, MentionCreated

**Messaging:**
- ConversationCreated, MessageSent

**Media:**
- MediaAssetCompleted, MediaAssetDeleted

**Moderation:**
- ReportCreated

**Billing:**
- PaymentProviderEventReceived, SubscriptionCreated, SubscriptionCancelled

### Configuration Keys

From AppConfig (infra/config):
- `outboxBatchSize` - Number of events to claim per batch (default: 10)
- `outboxMaxRetries` - Max retry attempts before dead-letter (default: 5)
- `outboxBaseBackoffMs` - Base backoff for exponential retry (default: 1000ms)
- `outboxMaxBackoffMs` - Max backoff cap (default: 60000ms)
- `outboxLeaseTimeoutMs` - Stale lock timeout (default: 300000ms = 5 minutes)

### Event Status Flow

- **PENDING** → **PROCESSING** (via claim)
- **PROCESSING** → **PROCESSED** (on success)
- **PROCESSING** → **PENDING** (on failure, with backoff)
- **PROCESSING** → **FAILED** (after max retries, moved to dead-letter)

### Concurrency Model

- **Claim concurrency**: Multiple processors can run, SKIP LOCKED prevents duplicate claims
- **Dispatch concurrency**: 4 workers process event groups in parallel
- **Aggregate ordering**: Events for same aggregateId processed sequentially
- **Leader lock**: Cleanup jobs use leader lock to prevent duplicate work

### Error Handling

- Processor errors are caught and logged (don't kill cron job)
- Failed events increment attempts counter
- Events exceeding max retries moved to dead-letter
- Dead-letter events can be replayed manually
- Stale locks recovered automatically

## Dependencies

### Internal Modules
- **infra/prisma** - Database access (OutboxEvent, OutboxDeadLetter, IdempotencyKey)
- **infra/config** - Outbox configuration (batch size, retries, backoff, lease timeout)
- **infra/scheduling** - Leader lock for cleanup jobs
- **Domain processors** - Profile, company, job, post, notification, messaging, billing, etc.

### External Dependencies
- **@nestjs/common** - NestJS framework
- **@nestjs/config** - Configuration service
- **@nestjs/schedule** - Cron job scheduling
- **@prisma/client** - Database client
- **nestjs-pino** - Structured logging
- **crypto** - randomUUID for processor IDs
- **zod** - Payload validation

### Database Schema
- **outbox_events** - Stores events (eventType, aggregateType, aggregateId, payload, status, attempts, availableAt, lockedAt, lockedBy)
- **outbox_dead_letters** - Stores failed events (outboxEventId, eventType, payload, reason)
- **idempotency_keys** - Prevents duplicate operations (scope, key, expiresAt)

### Indexes
- **outbox_events_pending_idx** - Index on (status, availableAt) for claim query
- **outbox_events_stale_lock_idx** - Index on (status, lockedAt) for stale lock recovery

### Outbox Events Emitted
- None (outbox is the event infrastructure itself)

### Outbox Events Consumed
- All 40+ event types are consumed by OutboxProcessor and routed to domain processors
