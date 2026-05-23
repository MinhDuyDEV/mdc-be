# ADR-0003: Deploy Target

## Status

Accepted — 2026-05-23

## Context

Current deploy workflow is a placeholder. A non-functional deploy workflow creates false confidence, goes stale, and can mislead reviewers into believing release automation exists.

No real production or staging target is documented yet.

## Decision

Delete the placeholder deploy workflow until a real target exists. Defer target-specific automation until the team chooses a deployment platform.

## Alternatives Considered

- **AWS ECR + ECS Fargate:** deferred until a real AWS environment exists.
- **GHCR + Kubernetes + ArgoCD:** deferred until a real Kubernetes environment exists.
- **Delete placeholder workflow:** accepted because it removes false confidence.

## Consequences

- No deploy automation exists until production environment is decided.
- CI remains focused on verification gates.
- Future deploy work must start from a concrete target, credentials model, rollback path, and environment strategy.

## Blocks

- Phase 5 Task 5.3 — delete placeholder deploy workflow or wire a real target.
