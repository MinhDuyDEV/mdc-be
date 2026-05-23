# ADR-0006: Cron Leader Election

## Status

Accepted — 2026-05-23

## Context

Background cleanup and scheduled jobs must be safe when multiple worker replicas run. Without leader election, every replica can execute the same cron work.

The project already depends on Redis, so per-job Redis locks avoid new infrastructure.

## Decision

Use Redis `SET NX EX` locks per cron job. Each scheduled job must acquire its own expiring lock before doing work.

## Alternatives Considered

- **Single-replica gating:** rejected because it reduces availability and relies on deployment shape.
- **External scheduler such as Kubernetes CronJob:** rejected for now because it changes infrastructure.
- **Redis `SET NX EX`:** accepted because Redis already exists and supports multi-replica workers.

## Consequences

- Scheduled jobs become multi-replica safe.
- Redis availability becomes prerequisite for cron execution.
- Locks must have safe TTLs and owner values to avoid accidental release by another worker.

## Blocks

- Phase 6 Task 6.4 — Redis `SET NX EX` leader election for cron jobs.
