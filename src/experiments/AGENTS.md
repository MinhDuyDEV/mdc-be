<!-- Parent: ../AGENTS.md -->

# Experiments Module

## Purpose

The Experiments module provides the server-side backing for client-side A/B
testing. It records impression events for experiment-variant assignments
into the outbox pattern, where the `ExperimentTrackingProcessor` persists
them as append-only analytics rows. Feature flag evaluation (Unleash) is
intentionally a separate concern, exposed via the `@Global()`
`FeatureFlagsModule` under `src/infra/feature-flags/`.

**Key responsibilities:**

- Accept a single `POST /experiments/track` endpoint to record an
  experiment impression event for the authenticated user.
- Emit an `ExperimentImpression` outbox event inside a transaction so the
  impression survives crashes and is processed by the worker role.
- Delegate flag/variant decisions to the client (the client calls Unleash
  directly via the SDK) — the server is the analytics sink, not the
  decision engine.

## Key Files

### Core Services

- **experiments.service.ts** - Outbox emission logic.
  - `trackEvent({ experimentId, userId, variant })` - Opens a transaction
    and emits one `ExperimentImpression` event with an aggregateId of
    `${experimentId}:${userId}` so per-experiment-per-user ordering is
    preserved on the consumer side.

### Controllers

- **experiments.controller.ts** - REST API for experiment tracking.
  - `POST /experiments/track` - Authenticated via the project-wide
    `AuthGuard` (`src/auth/auth.guard.ts`). Throttled at the global
    NestJS Throttler level (300 req / 60 s per IP). No per-route override
    for v1.

### Configuration

- **experiments.module.ts** - Module definition.
  - Imports: `InfraModule`, `OutboxCoreModule` (for `OutboxService.emit`).
  - Does NOT import `PassportModule` — auth is global, registered once in
    `src/auth/`. Importing Passport here is a pattern violation.
  - Exports: `ExperimentsService` (consumed by other modules if needed).

### DTOs

- **dto/track-experiment.dto.ts** - Request body for `POST /experiments/track`.
  - `experimentId: string` - bounded 100 chars (Prisma schema constraint).
  - `variant: string` - bounded 50 chars (Prisma schema constraint).

## For AI Agents

### Working with Experiments

**Event emission (server side):**

```ts
await this.prisma.$transaction(async (tx) => {
  await this.outbox.emit(tx, {
    eventType: 'ExperimentImpression',
    aggregateType: 'ExperimentImpression',
    aggregateId: `${experimentId}:${userId}`,
    payload: {
      experimentId,
      userId,
      variant,
      timestamp: new Date().toISOString(),
    },
  });
});
```

**Client side (reference):**
The client SDK decides flag state via Unleash, then calls
`POST /api/v1/experiments/track` with the resulting variant name. The
server is intentionally dumb — no flag evaluation happens here.

**Why append-only impressions?**
The `ExperimentImpression` model has `@@index([experimentId, userId])`
but no `@@unique(...)`. Returning users can be re-bucketed; the analytics
data should reflect that. The `ExperimentTrackingProcessor` is
intentionally unconditional (no dedup catch) — see
`src/outbox/processors/experiment-tracking.processor.ts`.

**Why `aggregateId = ${experimentId}:${userId}`?**
The outbox processor groups events by `aggregateId` and processes them
sequentially per group. Using the experiment+user tuple ensures the
impression order per (experiment, user) is preserved end-to-end.

### Testing Requirements

- **Unit tests must cover:**
  - `trackEvent` emits one outbox event with the correct shape.
  - `trackEvent` uses an aggregateId of `${experimentId}:${userId}`.
  - `trackEvent` is wrapped in a transaction (no double-emit on
    partial failure).

- **Integration tests should verify:**
  - End-to-end: HTTP `POST /experiments/track` → outbox row → processor
    row in `experiment_impressions` table.
  - Throttler responds with 429 when the per-IP limit is exceeded.

### Common Patterns

- **Outbox event shape** (consumed by `ExperimentTrackingProcessor`):

  ```ts
  interface ExperimentImpressionPayload {
    experimentId: string;
    userId: string;
    variant: string;
    timestamp: string; // ISO-8601
  }
  ```

- **Auth:** always use the project `AuthGuard` (`src/auth/auth.guard`),
  not `@nestjs/passport`'s `AuthGuard('jwt')`. The Passport strategy is
  not registered in this codebase.

## Dependencies

### Internal Modules

- **infra/prisma** - Database access (PrismaService).
- **outbox** - `OutboxService.emit` (from `OutboxCoreModule`).
- **auth** - `AuthGuard` for the controller's `@UseGuards` decorator.

### External Dependencies

- `@nestjs/common` - NestJS framework.
- `@prisma/client` - Database client (via `PrismaService`).

### Database Schema

- **experiment_impressions** - Stores impression rows.
  - `(experiment_id, user_id, variant, impressed_at)` — no `@@unique`,
    append-only.
  - `@@index([experimentId, userId])` for per-experiment-per-user lookups.
  - `@@index([experimentId])`, `@@index([userId])` for ad-hoc analytics.

### Outbox Events Emitted

- `ExperimentImpression` - One per accepted `POST /experiments/track`.

### Outbox Events Consumed

- None. This module is a producer only.
