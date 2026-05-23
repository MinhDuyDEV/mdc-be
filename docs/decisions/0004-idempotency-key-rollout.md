# ADR-0004: Idempotency-Key Rollout

## Status

Accepted — 2026-05-23

## Context

Current idempotency correctness issue is transactional: idempotency claims can commit outside the caller transaction and permanently block retries after failed creations.

Adding client-driven `Idempotency-Key` header support is useful, but it is product/API scope layered on top of correctness work.

## Decision

Defer request-header `Idempotency-Key` rollout to Phase 7. Fix transaction-correct idempotency first in Phase 4.

## Alternatives Considered

- **Ship header support now:** rejected because Phase 4 already has correctness-heavy work.
- **Ship header support later:** accepted because correctness should land before new public API behavior.
- **Skip header support:** rejected because client-driven idempotency remains valuable for safe retries.

## Consequences

- Phase 4 stays focused on correctness.
- Public API idempotency behavior waits until internals are trustworthy.
- Future header rollout can use the corrected transaction-aware idempotency service.

## Blocks

- Phase 7 Task 7.4 — request-header `Idempotency-Key` support.
