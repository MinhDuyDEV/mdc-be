# ADR-0005: Counter Strategy

## Status

Accepted — 2026-05-23

## Context

Entity-relationship denormalized counters such as follower, reaction, or application counts add write-path complexity and require reconciliation jobs. No measured hot-read bottleneck currently justifies that operational cost for those relationship counts.

Prisma `_count` can provide correct relationship counts directly from source-of-truth relations until profiling proves it is too slow. This decision does not remove specialized analytics counters such as `SlottedCounter`, which solve high-write analytics aggregation rather than entity relationship count display.

## Decision

Drop entity-relationship denormalized counters and use `_count` for relationship counts by default. Keep specialized analytics counters out of scope for this ADR.

## Alternatives Considered

- **Keep denormalized counters plus reconciliation job:** rejected as premature complexity.
- **Drop denormalized counters and use `_count`:** accepted as simpler and correct until measurements prove otherwise.

## Consequences

- Simpler relationship-count code and fewer reconciliation concerns.
- Some hot relationship-count reads may become slower.
- Counter optimization can return later with metrics and targeted caching.
- Existing analytics aggregation counters are not targeted by Phase 6 Task 6.8 unless a separate ADR changes analytics strategy.

## Blocks

- Phase 6 Task 6.8 — remove entity-relationship denormalized counters and use `_count`.
