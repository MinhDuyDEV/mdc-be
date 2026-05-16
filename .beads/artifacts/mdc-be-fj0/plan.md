# Phase 0A Repo Baseline and Core Infra Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `skill({ name: "executing-plans" })` to implement this plan task-by-task.

**Bead:** `mdc-be-fj0`  
**Goal:** Turn the bare NestJS starter into the Phase 0A production baseline: typed config, local Postgres/Redis, Prisma foundational schema, health probes, CommonModule API primitives, safe bootstrap, and verification scripts without starting Phase 0B or product-domain code.

**Discovery Level:** 3 — deep. This touches dependency selection, local services, database modeling, app bootstrap, global API contracts, and test strategy across multiple subsystems.

**Context Budget:** L-size work. Execute in 6 waves; keep each worker focused on one wave. Target ~50% context per execution by not combining discovery, dependency installation, schema, bootstrap, and tests in one worker pass.

**Architecture:** Modular monolith baseline. `src/infra/**` owns operational dependencies and health, `src/common/**` owns shared API primitives, `prisma/**` owns durable foundational tables, and `src/main.ts` owns HTTP bootstrap policy. Root `GET /` and unversioned `/health/*` stay compatible while future product API routes live under `/api/v1`.

**Tech Stack:** NestJS 11, TypeScript 5.7, npm, Jest 30, Prisma/Postgres, Redis via `ioredis`, Docker Compose, Helmet, class-validator/class-transformer.

---

## Discovery

- Memory grounding was attempted but local memory is degraded: `memory-search` returned `FTS5 not available`, and `memory-read handoffs/last` failed because this Node runtime lacks `node:sqlite`. Treat project files and bead artifacts as the source of truth for this plan.
- `br show mdc-be-fj0` confirms the bead is `IN_PROGRESS`, type `feature`, and scoped to Phase 0A only.
- No `.beads/artifacts/mdc-be-fj0/plan.md` existed at planning time. Because the current plan-mode system only permits writing `/Users/minhduydev/workspace/mdc/mdc-be/.opencode/plans/1778915621896-quick-wizard.md`, the build/command runner should copy this content to `.beads/artifacts/mdc-be-fj0/plan.md` before `/ship` if the command requires that canonical location.
- Git history has only `c78db53 first commit`; there are no prior local implementation patterns or fix/revert commits in affected files. Working branch is `feat/mdc-be-fj0-phase-0a-repo-baseline-core-infra`. Existing untracked `AGENTS.md` must be preserved and not staged by this work unless explicitly requested.
- Current repo state is a stock NestJS starter: `src/main.ts` creates `AppModule` and listens on raw `process.env.PORT`; `src/app.module.ts` imports no modules; `src/app.controller.ts`/`src/app.service.ts` provide root `Hello World!`; `src/app.controller.spec.ts` and `test/app.e2e-spec.ts` are starter tests.
- `package.json` lacks `typecheck` and Prisma scripts. Existing deps are only core Nest platform packages, `reflect-metadata`, and `rxjs`. `tsconfig.json` uses `nodenext`, ES2023, decorators, `strictNullChecks: true`, but `noImplicitAny: false` and `strictBindCallApply: false`.
- Repo config exploration found no root app `.env.example`, no `docker-compose.yml`, no `prisma/`, no Dockerfile, and no CI. `.opencode/.env.example` is OpenCodeKit config, not application config.
- Test pattern: unit tests are colocated under `src/**/*.spec.ts` with `@nestjs/testing`; e2e tests live under `test/*.e2e-spec.ts`, bootstrap `AppModule`, and use `supertest` against `app.getHttpServer()`.
- Official docs/source research: Nest supports global `ValidationPipe`, `app.enableCors()`, `app.setGlobalPrefix()`, and `ConfigModule.forRoot({ validate })`; Prisma’s Nest recipe uses `PrismaService extends PrismaClient` with lifecycle hooks; `ioredis` supports `lazyConnect`, `ping`, status events, `quit()`, and connection timeouts; Helmet is applied via Express middleware `app.use(helmet())`; Terminus v11 should use current `HealthCheckService`/indicator APIs and avoid deprecated old indicator classes.

---

## Constraints

- Execute **Phase 0A only**. Do not add MinIO/S3, Elasticsearch, SMTP/Nodemailer, OpenTelemetry, outbox processors, runtime roles, Dockerfile, CI/deploy automation, or product domains.
- Ask before adding dependencies. Wave 1 contains an explicit dependency approval checkpoint.
- Never commit secrets or `.env`; create safe `.env.example` only.
- Preserve root `GET /` response compatibility as plain `Hello World!`.
- Keep `/health/live` dependency-free; `/health/ready` fails closed when Postgres or Redis is unavailable.
- Use npm/package-lock; do not switch package managers.
- Avoid global API envelope behavior that wraps root smoke unexpectedly. If using a global interceptor/filter, explicitly bypass root and health routes or test that they remain compatible.
- No commits, pushes, bead close, or destructive git operations without user approval.

---

## Must-Haves

### Observable Truths

1. A maintainer can install Phase 0A dependencies and run package scripts for typecheck, Prisma validation/generation/migration, build, lint, unit tests, and e2e tests.
2. A maintainer can copy `.env.example`, start Postgres and Redis with Docker Compose, and get deterministic local service names/ports.
3. Prisma validates and generates a client for exactly the six foundational table families: user/session, audit, outbox, dead-letter, and idempotency.
4. The Nest app refuses to start with invalid required config and exposes typed config to bootstrap/providers after validation.
5. `GET /health/live` returns liveness without external dependencies, and `GET /health/ready` reports Postgres plus Redis readiness.
6. Shared common primitives exist for `{ data, meta? }` successes, `{ error: { code, message, details?, requestId? } }` errors, cursor pagination, auth placeholders, and policy placeholders.
7. The HTTP app applies `/api/v1`, validated request DTO behavior, configured CORS, body limits, Helmet headers, and still returns `Hello World!` from `GET /`.

### Required Artifacts

| Artifact | Provides | Path |
| --- | --- | --- |
| Package manifest and lockfile | Dependencies and verification scripts | `package.json`, `package-lock.json` |
| Strict compiler config | No implicit any / strict bind-call-apply baseline | `tsconfig.json` |
| Safe env template | Required Phase 0A config with placeholders only | `.env.example` |
| Local service topology | Postgres and Redis dev services | `docker-compose.yml` |
| Prisma schema and migration | Foundational durable model | `prisma/schema.prisma`, `prisma/migrations/**/migration.sql` |
| Infra module | Typed config, Prisma, Redis, health wiring | `src/infra/**` |
| Common module | API envelope, errors, pagination, auth/policy placeholders | `src/common/**` |
| App module and bootstrap | Module wiring and HTTP runtime policy | `src/app.module.ts`, `src/main.ts` |
| Smoke controller/service | Root route compatibility | `src/app.controller.ts`, `src/app.service.ts` |
| Unit and e2e tests | Contract, health, config validation verification | `src/**/*.spec.ts`, `test/app.e2e-spec.ts` |

### Key Links

| From | To | Via | Risk |
| --- | --- | --- | --- |
| `src/main.ts` | config provider | `app.get(ConfigService)` after `AppModule` compilation | Raw env reads bypass validation or missing config starts the server. |
| `src/app.module.ts` | `InfraModule` + `CommonModule` | module imports/providers | Providers are not visible or global app policies apply inconsistently. |
| `src/infra/config/*` | `.env.example` | same variable names/defaults | Example env drifts from required runtime schema. |
| `src/infra/health/*` | Prisma/Redis providers | `SELECT 1`/`$queryRaw` and `redis.ping()` | Readiness returns false success or hangs when dependencies are down. |
| `src/common/*` | root smoke route | global interceptor/filter or route exclusions | Root route becomes `{ data: "Hello World!" }`, breaking compatibility. |
| `prisma/schema.prisma` | migration SQL | `prisma migrate dev` | Migration creates Phase 0B/domain tables or schema differs from generated SQL. |
| tests | real dependencies | mocked vs Docker-backed tests | `npm run test:e2e` becomes flaky unless Docker preconditions are explicit or providers are overridden. |

---

## Dependency Graph

```text
Task A dependencies-1: needs nothing; creates package scripts and lockfile updates.
Task B tooling-1: needs Task A; creates strict TS baseline.
Task C infra-1: needs Task A; creates .env.example and docker-compose.yml.
Task D common-1: needs Task A; creates src/common/** primitives and tests.
Task E database-1: needs Task A + Task C; creates prisma/schema.prisma and first migration.
Task F infra-2: needs Task A + Task C + Task E; creates src/infra/** and wires AppModule.
Task G api-1: needs Task B + Task D + Task F; updates bootstrap/root compatibility.
Task H testing-1: needs Task D + Task F + Task G; completes unit/e2e contract coverage.

Wave 0: approval checkpoint for dependency list.
Wave 1: Task A.
Wave 2: Task B, Task C, Task D where file ownership is separated; serialize any AppModule edits.
Wave 3: Task E.
Wave 4: Task F.
Wave 5: Task G.
Wave 6: Task H and full verification.
```

---

## Tasks

### Wave 0: Dependency Approval Checkpoint

**Maps to PRD tasks:** `dependencies-1`  
**Files:** none yet  
**Checkpoint:** Required before `npm install` because user preference says ask before adding dependencies.

Proposed minimal Phase 0A packages:

| Package | Type | Purpose |
| --- | --- | --- |
| `@nestjs/config` | runtime | Load and validate typed environment config. |
| `@nestjs/terminus` | runtime | Health check framework. |
| `@prisma/client` | runtime | Prisma generated client runtime. |
| `ioredis` | runtime | Redis client for readiness and later cache/presence foundations. |
| `helmet` | runtime | HTTP security headers. |
| `class-validator` | runtime | DTO validation for Nest `ValidationPipe`. |
| `class-transformer` | runtime | DTO transformation for Nest `ValidationPipe`. |
| `prisma` | dev | Prisma CLI for validate/generate/migrate. |

Do not add Phase 0B dependencies. Avoid Joi/Zod for now by implementing a small typed `validateEnv` function; revisit only if config complexity grows.

**Verification:** approval recorded by the build agent before package mutation.

### Task A: Dependency and Script Baseline

**Maps to PRD task:** `dependencies-1`  
**Files:** `package.json`, `package-lock.json`

1. RED: Add no implementation yet; run `npm run typecheck` and confirm it fails with “missing script: typecheck”.
2. After dependency approval, run `npm install` with the Wave 0 package list.
3. Update `package.json` scripts:
   - `typecheck`: `tsc --noEmit`
   - `prisma:validate`: `prisma validate`
   - `prisma:generate`: `prisma generate`
   - `prisma:migrate`: `prisma migrate dev`
   - `prisma:migrate:deploy`: `prisma migrate deploy`
   - `db:reset`: `prisma migrate reset`
4. GREEN: run `npm run typecheck`; at this point it should pass or reveal starter fallout for Task B.
5. GREEN: run `npm run prisma:validate`; expected to fail until Task E creates `prisma/schema.prisma`. Record this as an expected blocked verification, not a completion failure.
6. Handoff: `package-lock.json` changes must be scoped to the approved packages only.

### Task B: Strict TypeScript Baseline

**Maps to PRD task:** `tooling-1`  
**Files:** `tsconfig.json`, starter/test files only if compiler requires it

1. RED: Set `noImplicitAny: true` and `strictBindCallApply: true` in `tsconfig.json`.
2. RED: run `npm run typecheck`; capture exact compiler failures.
3. GREEN: Fix only Phase 0A fallout in starter/test files. Do not relax strictness, unsafe casts, or ignore comments without written justification.
4. GREEN: run `npm run typecheck`; expected zero TypeScript errors.
5. GREEN: run `npm run build`; expected Nest build succeeds.

### Task C: Local Environment and Services

**Maps to PRD task:** `infra-1`  
**Files:** `.env.example`, `docker-compose.yml`

1. RED: run `docker compose config`; confirm it fails because no compose file exists.
2. Create `.env.example` with safe placeholders only: `NODE_ENV`, `PORT`, `DATABASE_URL`, Postgres user/password/db variables, `REDIS_URL`, `CORS_ORIGINS`, `BODY_JSON_LIMIT`, `BODY_URLENCODED_LIMIT`, and short health timeout settings.
3. Create `docker-compose.yml` with exactly two services: `postgres` and `redis`. Use named volumes for local persistence, healthchecks, and ports matching `.env.example`.
4. GREEN: run `docker compose config`; expected valid normalized config.
5. GREEN: run `docker compose up -d postgres redis && docker compose ps postgres redis`; expected both services healthy/running.
6. Cleanup guidance for builder: do not delete volumes automatically; if reset is needed, ask first.

### Task D: CommonModule Primitives

**Maps to PRD task:** `common-1`  
**Files:** `src/common/**`, `src/app.module.ts` if needed for provider registration

1. RED: create unit tests first for success envelope and exception envelope behavior. Expected failures: missing interceptor/filter/helpers.
2. RED: create unit tests for cursor pagination DTO validation and placeholder auth/policy exports. Expected failures: missing modules/types.
3. GREEN: implement `src/common/common.module.ts` and subfolders for:
   - response envelope types/helper/interceptor: `{ data, meta? }`
   - exception filter/error mapper: `{ error: { code, message, details?, requestId? } }`
   - pagination DTO/types: cursor, limit, next cursor metadata
   - validation pipe factory/options
   - auth placeholders such as `Public` metadata and `CurrentUser` decorator type shell
   - policy placeholder contracts/interfaces
4. Guardrail: if a global interceptor is registered, bypass root `/` and `/health/*` so smoke and health routes remain compatible. Prefer unit-tested primitives over exposing dummy product routes.
5. GREEN: run targeted common tests.
6. GREEN: run `npm run typecheck` and `npm test`.

### Task E: Prisma Foundation

**Maps to PRD task:** `database-1`  
**Files:** `prisma/schema.prisma`, `prisma/migrations/**/migration.sql`, `package.json` only if Prisma config requires it

1. RED: create a schema-review checklist test or script-free manual check in the task notes: the migration must create only `User`, `RefreshToken`, `AuditLog`, `OutboxEvent`, `OutboxDeadLetter`, and `IdempotencyKey` plus enums/indexes/constraints supporting those tables.
2. Create `prisma/schema.prisma` with `postgresql` datasource using `env("DATABASE_URL")` and a Prisma client generator.
3. Define minimal foundational models:
   - `User`: id, email unique, passwordHash nullable, emailVerifiedAt nullable, status enum, timestamps.
   - `RefreshToken`: id, userId relation, tokenHash unique, expiresAt, revokedAt nullable, timestamps, indexes for user/expires.
   - `AuditLog`: id, actorUserId nullable relation, action, entityType, entityId nullable, metadata JSON nullable, ip/userAgent nullable, createdAt, indexes for actor/entity/action/time.
   - `OutboxEvent`: id, eventType, aggregateType/id nullable, payload JSON, status enum, attempts, availableAt, lockedAt/lockedBy nullable, processedAt nullable, timestamps, index for leasing by status/availableAt.
   - `OutboxDeadLetter`: id, outboxEventId nullable/unique where supported by Prisma relation design, eventType, payload JSON, reason, failedAt, relation to event if practical.
   - `IdempotencyKey`: id, scope, key, requestHash, responseStatus nullable, responseBody JSON nullable, expiresAt, timestamps, unique `(scope, key)`, expiry index.
4. GREEN: run `npm run prisma:validate`; expected schema valid.
5. GREEN: run `npm run prisma:generate`; expected client generated.
6. GREEN: with Docker Postgres running, run `npm run prisma:migrate -- --name init_baseline`; expected first migration SQL under `prisma/migrations/**/migration.sql`.
7. Review migration SQL manually for scope creep before continuing.

### Task F: InfraModule Baseline

**Maps to PRD task:** `infra-2`  
**Files:** `src/infra/**`, `src/app.module.ts`, `.env.example` only if a required variable was missed

1. RED: write unit tests for `validateEnv`: valid env returns typed config; missing/invalid `DATABASE_URL`, `REDIS_URL`, `PORT`, body limits, or CORS config throws before app listen.
2. RED: write unit tests for health service/indicators using mocked Prisma and Redis providers: live check always succeeds; ready check fails closed on either dependency failure.
3. GREEN: implement `InfraModule` with:
   - config module using `@nestjs/config` and custom `validateEnv`
   - typed config tokens/services for app/http/cors/database/redis/health settings
   - `PrismaService` lifecycle with `$connect`/`$disconnect`
   - Redis provider using `ioredis` with short connect/command timeouts and graceful `quit()`/`disconnect()` lifecycle
   - `HealthController` exposing `GET /health/live` and `GET /health/ready`
4. Wire `InfraModule` into `src/app.module.ts`.
5. GREEN: run targeted infra tests, then `npm run typecheck` and `npm run build`.
6. GREEN: with Docker services and app running, verify `curl -fsS http://localhost:3000/health/live` and `curl -fsS http://localhost:3000/health/ready`.

### Task G: Safe Bootstrap and Route Compatibility

**Maps to PRD task:** `api-1`  
**Files:** `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, bootstrap helper files if extracted

1. RED: add/keep e2e test asserting `GET /` returns status 200 and exact body `Hello World!`.
2. RED: add e2e/unit coverage that app bootstrap config applies global prefix exclusions for `/` and `/health/*` while future API routes use `/api/v1`.
3. GREEN: update `src/main.ts` to:
   - create app from `AppModule`
   - use configured JSON and URL-encoded body limits
   - apply `helmet()`
   - apply global validation pipe with whitelist, transform, and forbidden non-whitelisted fields
   - apply CORS origins from validated config
   - set global prefix `api/v1` while excluding `/` and `/health/live`, `/health/ready`
   - use typed port config
   - enable shutdown hooks if Prisma/Redis lifecycle uses them
   - avoid floating `bootstrap()` promise warning by handling rejection or voiding intentionally
4. Preserve `AppController` and `AppService` root behavior unless tests require a typed cleanup.
5. GREEN: run `npm run typecheck`, `npm run build`, and `curl -fsS http://localhost:3000/`.

### Task H: Contract and Health Tests

**Maps to PRD task:** `testing-1`  
**Files:** `src/**/*.spec.ts`, `test/app.e2e-spec.ts`, `test/jest-e2e.json` only if required

1. RED: expand `test/app.e2e-spec.ts` with root, health live, health ready, security header, body limit, and version-prefix expectations. Use provider overrides or clearly documented Docker preconditions so CI-style e2e does not become flaky.
2. RED: add focused unit tests for config validation, response envelope, exception envelope, Prisma lifecycle, Redis readiness, and health service failure modes.
3. GREEN: implement or adjust production code only to satisfy tests. Do not add product-domain controllers or fake product endpoints.
4. GREEN: run `npm test`; expected all unit specs pass.
5. GREEN: run `npm run test:e2e`; expected e2e specs pass under documented local service/mocked-provider setup.
6. GREEN: run `npm run lint`; note current script auto-fixes, so review formatting-only diffs and do not stage unrelated files.
7. Final full verification sequence:
   - `npm install`
   - `npm run prisma:validate`
   - `npm run prisma:generate`
   - `npm run typecheck`
   - `npm run build`
   - `npm run lint`
   - `npm test`
   - `npm run test:e2e`
   - `docker compose up -d postgres redis && docker compose ps postgres redis`
   - `curl -fsS http://localhost:3000/health/live`
   - `curl -fsS http://localhost:3000/health/ready`
   - `curl -fsS http://localhost:3000/`

---

## Risks & Failure Behavior

- Dependency approval may block Wave 1. If blocked, stop before editing package files and report the package list plus rationale.
- Prisma migration may overreach. If migration includes Phase 0B/product tables, revert only the migration/schema changes from this task and narrow the model set.
- Readiness may be flaky if tests require real Docker services. Prefer mocked provider tests for `npm run test:e2e`; keep Docker/curl as explicit smoke checks.
- Global envelopes may break root compatibility. Tests must catch this before implementation proceeds beyond Task D/G.
- Config validation could make tests fail due missing env. Tests should set a minimal safe env or use ConfigModule overrides; production startup should still fail closed.
- `npm run lint` auto-fixes; review diffs and stage specific files only if committing is later approved.

## Privacy & Security

- `.env.example` must contain placeholders/safe local defaults only; never commit `.env`, secrets, tokens, real credentials, resumes, private notes, or message bodies.
- Helmet and body limits are mandatory before public endpoints expand.
- Error envelopes should avoid leaking stack traces or raw dependency errors in production-shaped responses.
- Audit/outbox/idempotency schemas may store metadata JSON; do not include logging of sensitive payloads in Phase 0A.

## Constitutional Compliance Check

| Check | Result | Action |
| --- | --- | --- |
| Critical git/destructive patterns | PASS in plan text | No destructive git operations included. |
| New dependencies | WARNING | Wave 0 requires explicit approval before package mutation. |
| Tasks touching more than three files | WARNING | Work is split by dependency waves and file ownership; serialize shared `src/app.module.ts` edits. |
| Unsafe typing shortcuts | PASS | Plan forbids unreviewed unsafe casts / ignore comments. |
| Secrets | PASS | Plan requires safe `.env.example` only. |

## Open Questions

- Should `/health/*` remain unversioned permanently, or is Phase 0A only requiring unversioned smoke while later API docs expose `/api/v1/health/*` too? Plan assumes unversioned `/health/live` and `/health/ready` because PRD verification uses those paths.
- Should `npm run test:e2e` require real Postgres/Redis, or should e2e override providers and leave real dependencies to Docker/curl smoke? Plan recommends mocked/overridden providers for reliable e2e, plus explicit Docker/curl smoke.

## Child Bead Hierarchy

Not created in this plan-mode pass because only the plan file may be edited and user approval is required before bead hierarchy/state changes. If desired, create child beads for Waves 1-2, Wave 3, Wave 4, and Waves 5-6 before `/ship`.

## Next Step

Run `/ship mdc-be-fj0` after approving the dependency checkpoint and, if required by your workflow, copying this plan into `.beads/artifacts/mdc-be-fj0/plan.md`.
