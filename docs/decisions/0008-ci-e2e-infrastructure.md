# ADR-0008: CI E2E Infrastructure

## Status

Accepted — 2026-05-23

## Context

E2E tests need reproducible infrastructure for Postgres, Redis, MinIO/S3, Elasticsearch, and SMTP/MailHog behavior. GitHub Actions services differ from local development and can create CI-only quirks.

The project already includes Testcontainers dependencies.

## Decision

Use Testcontainers for all E2E infrastructure in CI and local runs.

## Alternatives Considered

- **GitHub Actions `services:`:** rejected because behavior differs from local runs and can be harder to reproduce.
- **Testcontainers for all infra:** accepted because it makes local and CI E2E topology identical.

## Consequences

- E2E runs may be slower.
- Test failures become easier to reproduce locally.
- CI must support Docker for Testcontainers.

## Blocks

- Phase 5 Task 5.2 — CI E2E infra with Testcontainers.
