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

## Architecture Decision Records

Phase 0 decisions that guide implementation:

- [ADR-0001: Refresh Token Shape](decisions/0001-refresh-token-shape.md)
- [ADR-0002: Media Visibility Model](decisions/0002-media-visibility-model.md)
- [ADR-0003: Deploy Target](decisions/0003-deploy-target.md)
- [ADR-0004: Idempotency-Key Rollout](decisions/0004-idempotency-key-rollout.md)
- [ADR-0005: Counter Strategy](decisions/0005-counter-strategy.md)
- [ADR-0006: Cron Leader Election](decisions/0006-cron-leader-election.md)
- [ADR-0007: Schema Organization](decisions/0007-schema-organization.md)
- [ADR-0008: CI E2E Infrastructure](decisions/0008-ci-e2e-infrastructure.md)

## Branch Protection

Required checks before merge to `main`:

1. **Typecheck:** `npm run typecheck`
2. **Lint:** `npm run lint` (strict, `--max-warnings 0` after Phase 1)
3. **Tests:** `npm test`
4. **Build:** `npm run build`
5. **Prisma:** `npx prisma validate`

See [Baseline Verification Snapshot](baseline/2026-05-baseline.md) for current CI behavior and Phase 1 improvements.

**Manual follow-up required:** GitHub branch protection settings must be configured in the repository UI to enforce these checks. Agent cannot modify GitHub settings without explicit credentials and approval.
