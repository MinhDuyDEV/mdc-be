# Architecture

## Outbox Pattern

The outbox pattern ensures reliable event delivery by writing events to the database in the same transaction as domain changes.

### Components

- **OutboxService**: Transactional event creation
- **OutboxProcessor**: Polling, leasing, retry, dead-letter
- **IdempotencyService**: Deduplication
- **DeadLetterService**: Failed event management

### Flow

1. Domain service calls `OutboxService.emit(tx, event)` inside transaction
2. Event written to `outbox_events` table with `status=PENDING`
3. OutboxProcessor polls every 5s, claims events with `SELECT FOR UPDATE SKIP LOCKED`
4. Processor dispatches to handlers, marks `PROCESSED` on success
5. On failure: retry with exponential backoff, move to dead-letter after 5 attempts

## Process Roles

- `api`: HTTP routes only, no background processing
- `worker`: Background processing only (outbox, scheduled jobs)
- `realtime`: WebSocket connections (Phase 8)
- `all`: Everything (local dev)

Set via `APP_PROCESS_ROLE` environment variable.

## Modules

### OutboxModule

Responsible for durable event processing via the transactional outbox pattern. Domain services call `OutboxService.emit()` inside existing Prisma transactions to atomically persist events alongside domain changes. The processor polls pending events with `SKIP LOCKED` for concurrent workers.
