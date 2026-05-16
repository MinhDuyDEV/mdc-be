# Phase 0A: Repo Baseline and Core Infra

**Bead:** mdc-be-fj0  
**Created:** 2026-05-16  
**Status:** Approved for `/ship`

## Bead Metadata

```yaml
depends_on: []
parallel: false
conflicts_with: []
blocks: []
estimated_hours: 3
```

---

## Problem Statement

### What problem are we solving?

The repository is still a bare NestJS starter and cannot yet support the planned LinkedIn-like job social network. Phase 0A establishes the minimal production baseline: validated configuration, Prisma/Postgres, Redis, security bootstrap, API envelope primitives, and health checks without starting Phase 0B adapters or product domains.

### Why now?

The source plan identifies Phase 0A as the immediate next implementation target and explicitly warns not to implement all of Phase 0 at once. Establishing this baseline first prevents later product modules from building on unsafe config, missing database primitives, weak TypeScript settings, or inconsistent API contracts.

### Who is affected?

- **Primary users:** Future API consumers and product-domain implementers who need stable `/api/v1` contracts, health checks, and foundational persistence.
- **Secondary users:** Backend maintainers and deployment operators who need deterministic local services, safe startup failure, and verification scripts before Phase 0B begins.

---

## Scope

### In-Scope

- Add Phase 0A runtime and development dependencies needed for config validation, Prisma/Postgres, Redis, health checks, validation, and HTTP security headers.
- Add scripts for typechecking, Prisma validation/generation/migration, and test database workflows.
- Tighten TypeScript settings while the repo is small by enabling `noImplicitAny` and `strictBindCallApply`.
- Add `.env.example` with safe placeholders only.
- Add Docker Compose services for Postgres and Redis only.
- Add Prisma baseline schema and first migration for `User`, `RefreshToken`, `AuditLog`, `OutboxEvent`, `OutboxDeadLetter`, and `IdempotencyKey` only.
- Add `InfraModule` with typed config, Prisma, Redis, and health/live readiness for Postgres plus Redis.
- Add `CommonModule` primitives for validation, API success/error envelopes, cursor pagination, auth decorators/placeholders, and policy placeholders.
- Update bootstrap to configure global validation, `/api/v1` prefix, CORS from config, request body limits, Helmet security headers, and root smoke route compatibility.
- Update unit/e2e tests for the baseline contract and health smoke.

### Out-of-Scope

- Phase 0B operational adapters: MinIO/S3, Elasticsearch, SMTP/Nodemailer, structured logging, OpenTelemetry, search facade, and expanded readiness for those dependencies.
- Phase 0C work: outbox processors, runtime role separation, Dockerfile, `.dockerignore`, GitHub Actions, deploy workflows, security workflows, and runbook skeletons.
- Product domain implementation for auth, users, profiles, companies, jobs, applications, feed, messaging, notifications, search, analytics, billing, moderation, or admin APIs.
- Real JWT authentication, password flows, email verification, recruiter outreach, and account trust enforcement.
- Microservices, queues, Kubernetes manifests, payment SDKs, and vendor-specific observability SDKs.

---

## Proposed Solution

### Overview

Convert the starter NestJS app into a small but production-minded baseline. The app should boot from validated environment configuration, expose versioned API routes plus health probes, connect to local Postgres and Redis through infrastructure providers, enforce global request validation and security headers, and provide shared response/error/pagination primitives that later domain modules can reuse.

### User Flow

This is backend infrastructure work rather than an end-user feature. A maintainer starts Postgres and Redis with Docker Compose, installs dependencies, validates/generates Prisma, runs typecheck/build/lint/tests/e2e, then verifies `/health/live`, `/health/ready`, and the root smoke route.

---

## Requirements

### Functional Requirements

#### Dependency and Script Baseline

The repository has the minimal Phase 0A dependency set and package scripts required to verify config, Prisma, type safety, tests, and local database workflows.

**Scenarios:**

- **WHEN** a maintainer runs `npm install` **THEN** the lockfile includes the Phase 0A dependencies without adding Phase 0B-only adapters.
- **WHEN** a maintainer runs `npm run typecheck` **THEN** TypeScript checks the project without emitting build output.
- **WHEN** a maintainer runs Prisma scripts **THEN** schema validation and client generation are available through package scripts.

#### Strict TypeScript Baseline

The project enforces stricter TypeScript checks before product code is added.

**Scenarios:**

- **WHEN** `npm run typecheck` runs **THEN** `noImplicitAny` and `strictBindCallApply` are active and starter-code fallout is fixed.
- **WHEN** new code omits unsafe implicit types **THEN** TypeScript reports them during verification.

#### Local Data Services

Local Postgres and Redis can start from committed Docker Compose configuration with safe default credentials only.

**Scenarios:**

- **WHEN** Docker Compose starts the Phase 0A services **THEN** Postgres and Redis become reachable for local development and health checks.
- **WHEN** `.env.example` is copied to a local `.env` **THEN** it documents all required Phase 0A variables without secrets.

#### Prisma Foundational Data Model

Prisma defines the initial durable schema for account/session/audit/outbox/idempotency foundations only.

**Scenarios:**

- **WHEN** `npx prisma validate` runs **THEN** the schema is valid.
- **WHEN** `npx prisma generate` runs **THEN** the Prisma client is generated successfully.
- **WHEN** migrations are inspected **THEN** the first migration creates only `User`, `RefreshToken`, `AuditLog`, `OutboxEvent`, `OutboxDeadLetter`, and `IdempotencyKey` plus required indexes/constraints.

#### InfraModule

Infrastructure providers expose typed config, Prisma, Redis, and health services without embedding product-domain rules.

**Scenarios:**

- **WHEN** required config is missing or invalid **THEN** app startup fails before listening.
- **WHEN** `/health/live` is requested **THEN** it returns process liveness without requiring external dependencies.
- **WHEN** `/health/ready` is requested with Postgres and Redis available **THEN** it reports readiness successfully.

#### CommonModule Primitives

Shared primitives exist for API envelopes, errors, pagination, validation, auth placeholders, and policy placeholders.

**Scenarios:**

- **WHEN** a controller returns successful data through the shared envelope helper/interceptor **THEN** the public response shape is `{ data, meta? }`.
- **WHEN** an exception reaches the global error mapper/filter **THEN** the public error shape is `{ error: { code, message, details?, requestId? } }`.
- **WHEN** future modules need auth/policy placeholders **THEN** they can import decorators and placeholder policy contracts from `src/common` without implementing real auth yet.

#### Safe Bootstrap

The Nest app applies baseline HTTP security and API contract settings during startup.

**Scenarios:**

- **WHEN** the app starts **THEN** it sets `/api/v1` as the public API prefix while keeping the root `GET /` smoke route compatible.
- **WHEN** requests exceed configured JSON or URL-encoded body limits **THEN** Express rejects them according to config.
- **WHEN** CORS origins are configured **THEN** bootstrap applies them from validated config.
- **WHEN** Helmet is enabled **THEN** security headers are present on HTTP responses.

### Non-Functional Requirements

- **Performance:** Health checks and bootstrap primitives should add negligible overhead; readiness checks should use short timeouts and not block indefinitely.
- **Security:** Never commit real secrets or `.env`; redact/token fields must not be introduced in logs; body size limits and Helmet are required before public endpoints are added.
- **Accessibility:** Not applicable; backend-only infrastructure work.
- **Compatibility:** Preserve NestJS 11, TypeScript 5.7, Node >=20.19, npm/package-lock, and `moduleResolution: nodenext` conventions.

---

## Success Criteria

- [ ] Dependencies and package scripts support the Phase 0A verification workflow.
  - Verify: `npm install`
  - Verify: `npm run typecheck`
- [ ] Prisma baseline schema and migration are valid and generate a client.
  - Verify: `npx prisma validate`
  - Verify: `npx prisma generate`
- [ ] TypeScript strictness is tightened and the project compiles.
  - Verify: `npm run typecheck`
  - Verify: `npm run build`
- [ ] Lint, unit tests, and e2e tests pass after bootstrap and contract changes.
  - Verify: `npm run lint`
  - Verify: `npm test`
  - Verify: `npm run test:e2e`
- [ ] Local Postgres and Redis start successfully from Docker Compose.
  - Verify: `docker compose up -d postgres redis && docker compose ps postgres redis`
- [ ] Health endpoints work against running local dependencies.
  - Verify: `curl -fsS http://localhost:3000/health/live`
  - Verify: `curl -fsS http://localhost:3000/health/ready`
- [ ] Root smoke route compatibility is preserved.
  - Verify: `curl -fsS http://localhost:3000/`

---

## Technical Context

### Existing Patterns

- `src/app.module.ts` currently imports no feature modules and is the correct integration point for `InfraModule` and `CommonModule`.
- `src/main.ts` currently creates the Nest app and listens on `process.env.PORT ?? 3000`; Phase 0A should replace raw env reads with typed config and safe bootstrap setup.
- `src/app.controller.ts` and `src/app.service.ts` currently provide the root `GET /` smoke route and should remain compatible.
- `test/app.e2e-spec.ts` currently verifies only `GET /`; it must expand to health/API-contract smoke coverage.
- `package.json` has build/lint/unit/e2e scripts but no `typecheck` or Prisma scripts.
- `tsconfig.json` currently has `noImplicitAny: false` and `strictBindCallApply: false`.

### Key Files

- `package.json` - Add dependencies and verification scripts.
- `package-lock.json` - Update lockfile through npm install.
- `tsconfig.json` - Tighten TypeScript compiler options.
- `.env.example` - Document safe Phase 0A config placeholders.
- `docker-compose.yml` - Add local Postgres and Redis services only.
- `prisma/schema.prisma` - Define baseline Prisma schema.
- `prisma/migrations/*/migration.sql` - First migration for foundational tables.
- `src/app.module.ts` - Wire common and infra modules.
- `src/main.ts` - Configure safe bootstrap.
- `src/infra/**` - Add typed config, Prisma, Redis, and health providers/controllers.
- `src/common/**` - Add validation, envelope, error, pagination, auth placeholder, and policy primitives.
- `src/app.controller.ts` - Preserve root smoke route behavior.
- `test/app.e2e-spec.ts` - Verify root and health smoke behavior.

### Affected Files

Files this bead will modify or create for conflict detection:

```yaml
files:
  - package.json
  - package-lock.json
  - tsconfig.json
  - .env.example
  - docker-compose.yml
  - prisma/schema.prisma
  - prisma/migrations/**/migration.sql
  - src/app.module.ts
  - src/main.ts
  - src/app.controller.ts
  - src/app.service.ts
  - src/infra/**
  - src/common/**
  - src/app.controller.spec.ts
  - test/app.e2e-spec.ts
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| New dependencies exceed Phase 0A scope | Medium | Medium | Add only config, validation, Prisma/Postgres, Redis, health, and Helmet dependencies; defer S3, Elasticsearch, mail, logging, telemetry, JWT, and runtime roles. |
| Prisma migration is too broad | Medium | High | Restrict first migration to the six Phase 0 models and verify schema/migration review before `/ship` completes. |
| Health readiness becomes flaky without local services | Medium | Medium | Keep liveness dependency-free; make readiness depend only on Postgres/Redis and document Docker Compose smoke. |
| API envelope changes break root smoke compatibility | Medium | Medium | Keep `GET /` compatibility explicitly covered by unit/e2e tests while versioned API routes use the new envelope. |
| Strict TypeScript uncovers starter/test typing issues | Medium | Low | Fix only Phase 0A fallout in touched starter/test files; avoid broader refactors. |
| Package scripts reference unavailable services | Low | Medium | Separate pure verification commands from Docker-backed smoke commands and document required Docker Compose startup. |

---

## Open Questions

| Question | Owner | Due Date | Status |
| --- | --- | --- | --- |
| Should `/health/ready` fail closed when either Postgres or Redis is unavailable? | Implementer | During `/ship mdc-be-fj0` | Resolved by PRD: yes, readiness should fail closed; liveness remains dependency-free. |
| Should MinIO, Elasticsearch, mail, logging, OpenTelemetry, Dockerfile, and CI be included now? | Implementer | Before `/ship mdc-be-fj0` | Resolved by source plan: no, they are Phase 0B/0C. |

---

## Tasks

### Dependency and script baseline [dependencies]

The repository has the Phase 0A npm dependencies and package scripts required for typechecking, Prisma validation/generation/migration, and test database workflows.

**Metadata:**

```yaml
depends_on: []
parallel: false
conflicts_with: ["Strict TypeScript baseline", "Prisma foundation", "InfraModule baseline", "CommonModule primitives", "Safe bootstrap"]
files:
  - package.json
  - package-lock.json
```

**Verification:**

- `npm install`
- `npm run typecheck`
- `npm run prisma:validate`
- `npm run prisma:generate`

### Strict TypeScript baseline [tooling]

The TypeScript configuration rejects implicit `any` and unsafe bind/call/apply usage while all starter and test code still typechecks.

**Metadata:**

```yaml
depends_on: ["Dependency and script baseline"]
parallel: false
conflicts_with: ["Safe bootstrap", "Contract and health tests"]
files:
  - tsconfig.json
  - src/**/*.ts
  - test/**/*.ts
```

**Verification:**

- `npm run typecheck`
- `npm run build`

### Local environment and services [infra]

Safe example environment variables and Docker Compose services allow local Postgres and Redis to start for Phase 0A development.

**Metadata:**

```yaml
depends_on: ["Dependency and script baseline"]
parallel: true
conflicts_with: ["InfraModule baseline"]
files:
  - .env.example
  - docker-compose.yml
```

**Verification:**

- `docker compose config`
- `docker compose up -d postgres redis && docker compose ps postgres redis`

### Prisma foundation [database]

The Prisma schema and first migration define only the Phase 0 foundational tables with appropriate indexes, constraints, and relation integrity.

**Metadata:**

```yaml
depends_on: ["Dependency and script baseline", "Local environment and services"]
parallel: false
conflicts_with: ["InfraModule baseline"]
files:
  - prisma/schema.prisma
  - prisma/migrations/**/migration.sql
  - package.json
```

**Verification:**

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run prisma:migrate`

### InfraModule baseline [infra]

`InfraModule` exposes typed config, Prisma, Redis, and health/live/readiness support for Postgres and Redis without product-domain logic.

**Metadata:**

```yaml
depends_on: ["Dependency and script baseline", "Local environment and services", "Prisma foundation"]
parallel: false
conflicts_with: ["Safe bootstrap", "Contract and health tests"]
files:
  - src/infra/**
  - src/app.module.ts
  - .env.example
  - package.json
```

**Verification:**

- `npm run typecheck`
- `npm run build`
- `curl -fsS http://localhost:3000/health/live`
- `curl -fsS http://localhost:3000/health/ready`

### CommonModule primitives [common]

`CommonModule` provides validation, response and error envelope helpers, cursor pagination types, auth placeholder decorators, and policy placeholder contracts for future modules.

**Metadata:**

```yaml
depends_on: ["Dependency and script baseline"]
parallel: true
conflicts_with: ["Safe bootstrap", "Contract and health tests"]
files:
  - src/common/**
  - src/app.module.ts
```

**Verification:**

- `npm run typecheck`
- `npm test`

### Safe bootstrap [api]

The Nest bootstrap applies global validation, `/api/v1`, CORS, request body limits, Helmet security headers, typed port config, and preserves the root smoke route.

**Metadata:**

```yaml
depends_on: ["InfraModule baseline", "CommonModule primitives", "Strict TypeScript baseline"]
parallel: false
conflicts_with: ["Contract and health tests"]
files:
  - src/main.ts
  - src/app.module.ts
  - src/app.controller.ts
  - src/app.service.ts
```

**Verification:**

- `npm run typecheck`
- `npm run build`
- `curl -fsS http://localhost:3000/`

### Contract and health tests [testing]

Unit and e2e tests verify root smoke compatibility, health endpoints, config validation failure behavior, and API envelope/error primitives.

**Metadata:**

```yaml
depends_on: ["InfraModule baseline", "CommonModule primitives", "Safe bootstrap"]
parallel: false
conflicts_with: []
files:
  - src/**/*.spec.ts
  - test/app.e2e-spec.ts
  - test/jest-e2e.json
```

**Verification:**

- `npm test`
- `npm run test:e2e`
- `npm run lint`

---

## Notes

- Source plan: `.opencode/plans/1778909319907-neon-meadow.md`, lines 1082-1105 define Phase 0A scope and verification.
- The current repo is a bare NestJS starter; no existing feature modules or database adapters need preservation.
- New dependency installation requires user awareness during `/ship`; this PRD records the required dependency categories but does not install them.
