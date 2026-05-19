<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# outbox

## Purpose
Transactional outbox pattern implementation providing reliable event emission, processing, and delivery. Ensures domain events are atomically committed with database transactions and processed asynchronously with retry, backoff, and dead letter handling.

## Key Files
| File | Description |
|------|-------------|
| `outbox.module.ts` | Module configuration registering OutboxService, OutboxProcessor, and event processors |
| `outbox.service.ts` | Event emission API for domain modules (must be called inside transactions) |
| `outbox.processor.ts` | Background cron job for claiming, dispatching, and retrying outbox events |
| `outbox.types.ts` | TypeScript types for outbox events |
| `outbox.constants.ts` | Constants for event types and configuration |
| `idempotency.service.ts` | Idempotency key management for preventing duplicate operations |
| `dead-letter.service.ts` | Dead letter queue for failed events after max retries |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `processors/` | Event-specific processors (profile-creation, profile-search-index, company-search-index) |

## For AI Agents

### Working In This Directory
- OutboxService.emit must be called inside a Prisma transaction (enforces transactional outbox pattern)
- OutboxProcessor runs every 5 seconds via @Cron decorator
- Event processing flow: claim (SKIP LOCKED) → dispatch → mark processed or requeue with backoff
- Retry strategy: exponential backoff with full jitter, max retries configurable
- Dead letter: events exceeding max retries are moved to dead_letter_events table
- Stale lock recovery: events locked longer than leaseTimeoutMs are released back to PENDING
- Event routing: OutboxProcessor.dispatch routes events to specific processors based on eventType
- Idempotency: IdempotencyService prevents duplicate operations using unique keys

### Testing Requirements
- Test OutboxService.emit throws error when called outside transaction
- Test OutboxProcessor claims events with SKIP LOCKED (no duplicate processing)
- Test retry with exponential backoff and jitter
- Test dead letter handling after max retries
- Test stale lock recovery for events locked too long
- Test event routing to correct processors
- Test idempotency key enforcement (duplicate claims throw ConflictException)
- Verify events are processed in order (oldest first)

### Common Patterns
- Domain modules call OutboxService.emit inside transactions to ensure atomicity
- Event processors implement specific business logic (e.g., indexing, notifications)
- Use IdempotencyService.claim for operations that must be idempotent (e.g., company creation)
- Backoff calculation: min(maxBackoffMs, baseBackoffMs * 2^attempt) with full jitter
- Lock recovery prevents stuck events from blocking the queue indefinitely

## Dependencies

### Internal
- `../infra/prisma` - Database access for outbox_events, dead_letter_events, idempotency_keys
- `../infra/config` - Outbox configuration (batch size, max retries, backoff, lease timeout)
- `nestjs-pino` - Structured logging for OutboxProcessor

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `@nestjs/schedule` - Cron job scheduling for OutboxProcessor
- `crypto` - randomUUID for lock IDs
