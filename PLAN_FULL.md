---
must_haves:
  truths:
    - "Users can register, authenticate, manage account state, and maintain rich professional profiles."
    - "Users can create or join companies, follow companies, publish jobs, save jobs, and apply through both internal applications and external application URLs."
    - "Users can connect, follow, block, post, comment, react, mention, use hashtags, and consume a full professional feed."
    - "Users can message each other; recruiters and company admins can message candidates when authorized by recruiting context."
    - "The platform supports in-app notifications, transactional email, S3-backed media, Postgres search fallback, Elasticsearch indexing, durable event fan-out, realtime delivery, and product analytics."
    - "The backend is a NestJS modular monolith with CI/CD, structured logging, OpenTelemetry observability, safe config, deployable containers, and clean domain boundaries for later service extraction."
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Postgres data model and migrations for all product domains"
    - path: "src/infra/*"
      provides: "Config, Prisma, Redis, S3, Elasticsearch, mail, logging, health, telemetry, runtime roles, and shared infrastructure"
    - path: "src/infra/observability/*"
      provides: "Structured logging, request correlation, OpenTelemetry traces/metrics, health/readiness/liveness, and redaction rules"
    - path: "src/common/*"
      provides: "Decorators, guards, policies, filters, pagination, validation, DTO helpers, and error contracts"
    - path: "src/outbox/*"
      provides: "Transactional outbox, durable domain events, retryable background processors, and idempotency controls"
    - path: "src/auth/*"
      provides: "JWT authentication, refresh tokens, password reset, current-user context, and auth rate limits"
    - path: "src/users/*"
      provides: "User account records, user status, identity lookup, and user-level preferences"
    - path: "src/profiles/*"
      provides: "Professional profiles, skills, experience, education, certifications, languages, and profile visibility"
    - path: "src/media/*"
      provides: "S3-backed uploads for avatars, company logos, resumes, post attachments, and message attachments"
    - path: "src/companies/*"
      provides: "Company pages, company members, admin roles, followers, and company ownership"
    - path: "src/jobs/*"
      provides: "Job posts, job search metadata, saved jobs, and job lifecycle"
    - path: "src/applications/*"
      provides: "Internal applications, external apply tracking, screening answers, application files, and employer review"
    - path: "src/recruiting/*"
      provides: "Recruiter seats, saved candidates, talent pools, candidate notes, and outreach authorization"
    - path: "src/connections/*"
      provides: "Connection requests, accepted professional network, follows, blocks, and graph visibility checks"
    - path: "src/posts/*"
      provides: "Posts, comments, reactions, mentions, hashtags, media attachments, and content visibility"
    - path: "src/feed/*"
      provides: "Home feed, profile feed, company feed, hashtag feed, ranking hooks, and cursor pagination"
    - path: "src/messaging/*"
      provides: "Conversations, direct messages, recruiter/company candidate messaging, attachments, read state, and participant authorization"
    - path: "src/realtime/*"
      provides: "WebSocket gateways for live messages, notifications, presence, and typing/read events"
    - path: "src/notifications/*"
      provides: "In-app notifications, unread counters, notification preferences, and event fan-in"
    - path: "src/email/*"
      provides: "Transactional email templates and delivery records"
    - path: "src/search/*"
      provides: "Postgres full-text fallback plus Elasticsearch indexing/query facade"
    - path: "src/recommendations/*"
      provides: "People, job, company, and feed recommendation endpoints after core data exists"
    - path: "src/analytics/*"
      provides: "Profile views, job views, post impressions, search logs, apply funnel metrics, and company analytics"
    - path: "src/billing/*"
      provides: "Plan entitlements, recruiter seats, job posting credits, subscriptions, invoices, and optional payment provider integration"
    - path: "src/moderation/*"
      provides: "Reports, blocks, content status, moderation actions, and safety workflows"
    - path: "src/admin/*"
      provides: "Internal admin APIs for users, companies, jobs, reports, and platform operations"
    - path: "src/audit/*"
      provides: "Audit logs, domain activity records, and security-sensitive change history"
    - path: ".github/workflows/ci.yml"
      provides: "Pull-request CI for install, lint, typecheck, tests, build, Prisma validation, and integration services"
    - path: ".github/workflows/deploy.yml"
      provides: "Environment-protected deployment pipeline with migrations, image promotion, and OIDC-based cloud auth"
    - path: ".github/workflows/security.yml"
      provides: "Dependency review, audit, CodeQL/secret-scanning hooks, and supply-chain checks"
    - path: "Dockerfile"
      provides: "Production container image for API/worker/realtime roles"
    - path: "docker-compose.yml"
      provides: "Local Postgres, Redis, MinIO, Elasticsearch, and optional observability stack"
    - path: "docs/architecture.md"
      provides: "Architecture decision records, module boundary map, runtime topology, and microservice extraction rules"
  key_links:
    - from: "src/auth/auth.guard.ts"
      to: "src/auth/auth.service.ts + JwtService"
      via: "Bearer-token verification and request.user attachment"
    - from: "src/common/policies/*"
      to: "domain services"
      via: "Owner/admin/participant/recruiter/candidate authorization decisions"
    - from: "src/*/*.service.ts"
      to: "src/infra/prisma/prisma.service.ts"
      via: "Injected PrismaService for durable reads and writes"
    - from: "src/*/*.service.ts"
      to: "src/outbox/outbox.service.ts"
      via: "Transactional domain events for search, email, notifications, audit, analytics, and realtime fan-out"
    - from: "src/media/media.service.ts"
      to: "src/infra/storage/s3.service.ts"
      via: "Presigned upload/download URLs and S3 object metadata"
    - from: "src/jobs/jobs.service.ts"
      to: "src/search/search-index.service.ts"
      via: "Job changes are indexed into Postgres search fields and Elasticsearch"
    - from: "src/applications/applications.service.ts"
      to: "src/messaging/messaging-policy.service.ts"
      via: "Recruiting context allows recruiter/company candidate conversations"
    - from: "src/recruiting/recruiting.service.ts"
      to: "src/messaging/messaging-policy.service.ts"
      via: "Recruiter seat, saved candidate, talent pool, and candidate contact preferences affect outreach permission"
    - from: "src/posts/posts.service.ts"
      to: "src/feed/feed.service.ts + src/notifications/notifications.service.ts"
      via: "Post events affect feeds and interaction notifications"
    - from: "src/connections/connections.service.ts"
      to: "src/feed/feed.service.ts + src/messaging/messaging-policy.service.ts"
      via: "Connection graph affects feed visibility and messaging permissions"
    - from: ".github/workflows/deploy.yml"
      to: "prisma/migrations + container image + environment secrets"
      via: "Deploy pipeline runs migration gate before application rollout"
    - from: "src/infra/observability/*"
      to: "all controllers/services/outbox processors"
      via: "Request IDs, trace IDs, metrics, logs, and redaction are applied consistently"
---

# Plan: Full LinkedIn-like Job Social Network Backend

## Goal

Build a production-minded NestJS 11 backend for a LinkedIn-like job social network. The system starts as a modular monolith using Prisma, Postgres, Redis, JWT, S3-compatible media storage, transactional email, Postgres full-text search, and an Elasticsearch facade. Boundaries must be explicit enough that high-traffic domains can later be extracted into separate services.

## Team Context

- **Team size**: 1 full-stack developer (solo execution)
- **Runway**: 9-12 weeks to first user value
- **Primary risk**: Scope creep and over-engineering before validation
- **Success criteria**: 
  - Working auth + profiles + jobs + applications vertical slice deployed to staging
  - Transactional outbox operational for reliable event processing
  - Clean module boundaries proven through at least one cross-domain feature
  - CI/CD pipeline functional with automated testing
  - Foundation ready for incremental feature additions without architectural rewrites

## Strategic Approach: Extraction-Ready Vertical Slice (Option D)

This plan follows **Option D** from the consensus planning phase: deliver a complete user-to-recruiter vertical slice in 9 weeks with extraction-ready architecture, deferring S3/Elasticsearch/OpenTelemetry to later phases when product validation justifies the operational complexity.

**Why Option D over Option A (full infrastructure upfront):**
- Solo developer context makes operational overhead of S3/Elasticsearch/OpenTelemetry premature
- Transactional outbox provides the critical reliability foundation without external dependencies
- Postgres full-text search is sufficient for initial job/profile discovery
- Local file storage acceptable for MVP resume uploads
- Can add S3/Elasticsearch/OpenTelemetry incrementally after user validation without architectural changes

**Extraction-ready principles preserved:**
- Transactional outbox from Phase 0 enables later async processing extraction
- Module boundaries and policy services designed for service extraction
- Storage/search/observability behind adapters for zero-refactor upgrades
- Authorization matrix and event flows documented for distributed enforcement

**Timeline to user value**: 9 weeks (Phases 0-4), with S3 in Phase 5, Elasticsearch in Phase 9, and OpenTelemetry in Phase 11 when operational maturity justifies the investment.

## Pre-Mortem: Failure Scenarios

### Scenario 1: Outbox Processor Stalls Under Load
**What happens**: Outbox events accumulate faster than processors can handle them. Email notifications delay by hours, search indexes become stale, analytics lag behind real-time state.

**Early warning signs**: Outbox pending count metric rises, oldest pending age exceeds 5 minutes, dead-letter count increases.

**Prevention**:
- Implement outbox metrics and alerting in Phase 0C
- Add processor concurrency controls and lease timeouts
- Test with synthetic load: 1000 events/minute sustained
- Design processors to be horizontally scalable (worker role separation)

**Mitigation if it happens**:
- Scale worker processes independently from API
- Add processor priority queues (critical: email/notifications, normal: search/analytics)
- Implement circuit breakers for failing downstream systems
- Add admin tooling to replay/skip dead-letter events

### Scenario 2: Authorization Policy Gaps Allow Unauthorized Access
**What happens**: A recruiter messages a candidate without valid recruiting context, or a non-admin views private application data. Security incident, user trust damage, potential regulatory violation.

**Early warning signs**: Audit logs show unexpected access patterns, users report receiving unwanted messages, security review finds missing policy checks.

**Prevention**:
- Write explicit `403` test for every protected endpoint in the authorization matrix
- Implement policy services as the single source of truth for authorization decisions
- Code review checklist: "Does this endpoint have an authorization test?"
- Add authorization integration tests that verify cross-domain rules (recruiting context → messaging permission)

**Mitigation if it happens**:
- Immediate: Add missing policy check, deploy hotfix, audit logs for unauthorized access
- Notify affected users if privacy breach occurred
- Add compensating audit log analysis to detect similar gaps
- Expand authorization test coverage to 100% of protected endpoints

### Scenario 3: Module Boundaries Erode, Extraction Becomes Impossible
**What happens**: Modules start importing each other's private files, direct Prisma writes cross domain boundaries, outbox events are skipped for "performance." When scale requires extraction, refactor takes months instead of weeks.

**Early warning signs**: Import cycles detected, modules depend on other modules' Prisma models directly, outbox usage inconsistent across domains.

**Prevention**:
- Enforce module boundary rules in code review: "Does this import violate the boundary rules?"
- Add linting rules to detect cross-module private imports
- Require outbox events for all cross-domain side effects (no exceptions)
- Document extraction readiness in architecture.md with concrete extraction steps

**Mitigation if it happens**:
- Freeze new features, dedicate sprint to boundary cleanup
- Introduce facade services to hide direct dependencies
- Refactor cross-domain writes to use exported service interfaces
- Add integration tests that verify module contracts

## Locked Product Decisions

- **D1: Messaging scope** — Users can message each other. Recruiters and company admins can also message candidates when there is a valid recruiting context, such as an application, company recruiter role, or candidate visibility rule.
- **D2: Job application modes** — Jobs support both internal applications and external apply URLs. A job may be internal-only, external-only, or hybrid.
- **D3: Feed scope** — Feed is a full social feed, not just a connection timeline. It supports user posts, company posts, comments, reactions, mentions, hashtags, media attachments, public visibility, network visibility, follower/company visibility, and cursor pagination.
- **D4: Search scope** — Implement both Postgres search fallback and Elasticsearch indexing/querying. Postgres remains the source-of-truth fallback; Elasticsearch powers richer product search.
- **D5: Media scope** — Use S3-compatible object storage from the beginning for avatars, company logos, resumes, post attachments, and message attachments.
- **D6: Architecture scope** — Build a modular monolith first. Avoid premature microservices, but keep domain imports and ownership clean.
- **D7: Event reliability scope** — Use a transactional outbox from the beginning for search indexing, notification fan-out, email delivery, audit, analytics, and realtime fan-out. In-process events alone are not reliable enough.
- **D8: Recruiter outreach scope** — Recruiters/company admins may message candidates if the candidate applied to one of their jobs, was saved to an authorized talent pool, or explicitly allows recruiter contact through profile visibility preferences.
- **D9: Public read scope** — Public profiles, public company pages, public jobs, and public posts can be read without authentication; all writes and non-public reads require authentication and policy checks.
- **D10: Application uniqueness scope** — A user may have one active application per job. Re-application after rejection is disabled by default unless a later product rule explicitly reopens the application.
- **D11: Search engine scope** — Elasticsearch is the selected external search engine. The implementation must pin the Docker image/client major version before Phase 0B instead of using floating `latest` tags.
- **D12: Email provider scope** — Start with an SMTP-compatible adapter through Nodemailer. Keep the provider behind `EmailService` so SES, SendGrid, or Resend can replace it without domain changes.
- **D13: CI/CD scope** — GitHub Actions is the default automation platform. CI must run on pull requests; deploy workflows must use GitHub environments, least-privilege permissions, and OIDC where the cloud provider supports it.
- **D14: Observability scope** — Structured JSON logs, request correlation IDs, OpenTelemetry traces/metrics, readiness/liveness health checks, and redaction rules are required from Phase 0.
- **D15: Deployment scope** — Build one production container image that can run as `api`, `worker`, `realtime`, or `all` through `APP_PROCESS_ROLE`. This preserves one codebase while enabling later independent scaling.
- **D16: Microservice-readiness scope** — Modules must communicate through exported interfaces, policy services, and outbox events. No module may depend on another module's private Prisma write model.
- **D17: API contract scope** — Public REST responses use a consistent versioned contract: success responses return `{ data, meta? }`; error responses return `{ error: { code, message, details?, requestId? } }`.
- **D18: Account trust scope** — Registration creates an unverified account; email verification is required before high-trust actions such as creating companies, posting jobs, recruiter outreach, and external-facing public posting.

## Constraints

- Hard: backend-first in this existing NestJS repo; no frontend in this plan.
- Hard: do not edit `dist/`; do not commit `.env` or secrets.
- Hard: use Prisma + Postgres for durable data.
- Hard: use Redis for cache, rate limits, presence, feed hints, and unread counters.
- Hard: use S3-compatible storage for all user-uploaded files from the beginning.
- Hard: implement search with both Postgres fallback and an Elasticsearch adapter.
- Hard: persist cross-domain side effects through a transactional outbox, not request-local in-process events only.
- Hard: every protected route must have explicit authorization ownership rules.
- Hard: all environment variables must be validated at startup; missing required config must fail fast.
- Hard: logs, traces, Elasticsearch documents, and analytics events must not contain secrets, tokens, resumes, private notes, or full message bodies.
- Hard: GitHub Actions deployment jobs must use protected environments and least-privilege permissions.
- Hard: JSON/body payload limits and security headers must be configured before public endpoints are added.
- Soft: REST API first; WebSockets are added after REST messaging and notifications are stable.
- Soft: modular monolith now; avoid `@nestjs/microservices`, Kubernetes, separate repos, and distributed transactions until scale proves the need.

## Discovery

- Current repository is a bare NestJS 11 starter: `src/app.module.ts` imports no feature modules, and `src/app.controller.ts` / `src/app.service.ts` only serve `Hello World!`.
- `package.json` currently has no Prisma, Postgres, Redis, auth, validation, config, hashing, S3, mail, search, or rate-limit packages. Existing scripts are `npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e`; there is no `typecheck` script yet.
- Tests are starter-only: `src/app.controller.spec.ts` and `test/app.e2e-spec.ts` only verify the root `GET /` response.
- TypeScript uses `module`/`moduleResolution: nodenext`, target `ES2023`, decorators enabled, `strictNullChecks: true`, and `noImplicitAny: false`.
- The existing repo shape supports a clean modular-monolith expansion because there are no legacy domain boundaries to preserve.

## Research Findings

- GitHub Actions supports workflow-level/job-level permissions, encrypted secrets, deployment environments, and OIDC federation. Use those controls for least-privilege CI/CD instead of long-lived cloud credentials.
- NestJS has first-class patterns for configuration, custom logging, health checks, OpenAPI generation, URI versioning, modules, and microservices. Use those primitives instead of ad-hoc bootstrap code.
- Prisma production migrations should be applied with `prisma migrate deploy`; migration files belong in source control and CI should validate/generate the Prisma client before deploy.
- OpenTelemetry provides standard traces, metrics, and logs instrumentation for Node.js. Use it as the vendor-neutral telemetry layer.
- S3 presigned URLs are appropriate for direct uploads, but file upload security still needs server-side metadata validation, private buckets, object ownership checks, size/type limits, and quarantine/scan lifecycle.
- Elasticsearch index aliases and versioned backing indexes support safer reindexing and later zero-downtime index changes.

## Review Update

Full-plan review found that the architecture is sound but Phase 0 was too large to execute safely as one batch. This plan now splits Phase 0 into smaller sub-slices, moves account trust/email verification into Phase 1, makes the rate limiter explicitly Redis-backed, standardizes API envelopes, adds body-size/security-header requirements, documents Prisma soft-delete/unique-index risk, and changes the immediate next implementation target to **Phase 0A only**.

## Recommended Architecture

Use a modular monolith with one infrastructure layer, one shared common layer, and product domains that own their own data contracts, DTOs, authorization decisions, and tests.

```text
src/
  infra/
    config/             # environment schema, app config
    prisma/             # PrismaService, transaction helpers
    redis/              # RedisService, cache helpers
    storage/            # S3-compatible storage client
    search-engine/      # external search client wrapper
    mailer/             # mail provider adapter
    logger/             # structured logging
    observability/      # OpenTelemetry, metrics, trace/log correlation
    health/             # readiness/liveness
    runtime/            # process roles: api, worker, realtime, all
  common/
    decorators/         # @CurrentUser, @Public, @Roles, etc.
    guards/             # auth guard, role guard, policy guard
    policies/           # reusable ownership/admin/participant checks
    filters/            # error envelope and exception mapping
    pagination/         # cursor pagination contracts
    dto/                # shared DTO primitives only
    events/             # internal domain event contracts
  outbox/               # durable event table, processors, retries, idempotency
  auth/
  users/
  profiles/
  media/
  companies/
  jobs/
  applications/
  recruiting/
  connections/
  posts/
  feed/
  messaging/
  realtime/
  notifications/
  email/
  search/
  recommendations/
  analytics/
  billing/
  moderation/
  admin/
  audit/
.github/
  workflows/
    ci.yml              # PR validation
    deploy.yml          # protected environment deploy
    security.yml        # dependency/security scanning
Dockerfile
docker-compose.yml
docs/
  architecture.md       # decisions, boundaries, extraction map
  runbooks/             # deploy, rollback, incident, migration runbooks
```

### Boundary Rules

- Controllers stay thin: parse request, call service, return DTO.
- Services own business rules and authorization checks.
- A module owns writes to its own tables. Other modules call the owner service for cross-domain writes.
- Direct Prisma reads across modules are acceptable only for simple read optimization; business decisions must call owning services or policy services.
- Cross-domain side effects use the transactional outbox. Domain writes and outbox event creation must happen in the same database transaction.
- External services must sit behind adapters: S3, email provider, external search engine. Domain services must not import provider SDKs directly.
- DTOs stay inside the owning module unless they are truly cross-cutting primitives.
- Prisma schema can be one file initially, but models must be grouped by domain and added through phased migrations.
- Every outbox processor must be idempotent. Retrying an event must not duplicate notifications, emails, Elasticsearch documents, analytics counters, or audit records.
- Every module must expose a narrow public API through its Nest provider exports. Other modules must not import private repositories, private DTOs, or private implementation files.
- Introduce explicit ports/interfaces for external systems and high-risk cross-domain capabilities so later microservice extraction replaces an in-process provider with an HTTP/gRPC/message client.
- New module dependencies must be checked for cycles. If two domains need bidirectional knowledge, move the relationship into a policy service, query service, or outbox event.

## Module Responsibilities

### `infra`

- Owns environment validation, Prisma, Redis, S3, Elasticsearch client, mail provider, health checks, logging, telemetry, and process-role bootstrap.
- Exports infrastructure services only; it should not know product domain rules.
- Adds `.env.example`, Docker Compose for Postgres/Redis/MinIO/Elasticsearch, and production-ready env names.
- Provides `ConfigService` wrappers with typed config objects, not raw `process.env` access outside `infra/config`.
- Provides structured logger with redaction and trace/request correlation.
- Provides OpenTelemetry bootstrap for traces/metrics and health checks for app, DB, Redis, S3, Elasticsearch, and outbox lag.

### `common`

- Owns request decorators, guards, exception filters, response/error envelope, cursor pagination, policy guard helpers, and common test factories.
- Keeps shared code small; avoid turning it into a dumping ground.

### `outbox`

- Owns durable domain event persistence, processor leasing, retry/backoff, dead-letter state, and idempotency keys.
- Handles fan-out to search indexing, notifications, email, audit, analytics, recommendations, and realtime delivery.
- Runs inside the monolith first; can later be extracted into worker processes or queue consumers without changing domain service contracts.

### `auth`

- Owns register, email verification, login, refresh, logout, password reset request/confirm, token hashing, session revocation, and login/register rate limits.
- Does not own profile data beyond creating the initial user account.

### `users`

- Owns core account state: email, username/slug if used, display name, role flags, account status, privacy baseline, and user preferences.
- Exposes identity lookup and account ownership checks to other modules.

### `profiles`

- Owns professional profile data: headline, about, location, website, open-to-work/recruiting flags, skills, experience, education, certifications, languages, endorsements, and visibility.
- Provides candidate profile views for recruiters/company admins.

### `media`

- Owns S3-backed media assets, file metadata, upload intents, presigned URLs, ownership checks, virus-scan status placeholder, and attachment linking.
- Supports avatars, company logos, resumes, post attachments, message attachments, and application attachments.

### `companies`

- Owns company pages, company members, member roles, admin permissions, company followers, company verification status, and company profile media.
- Exposes company-admin policy checks to `jobs`, `applications`, `messaging`, and `admin`.

### `jobs`

- Owns job posts, job lifecycle, job visibility, job locations, remote mode, compensation ranges, required skills, saved jobs, and job search metadata.
- Supports internal apply, external apply URL, and hybrid jobs.
- Does not own application workflow; that belongs to `applications`.

### `applications`

- Owns applications, screening answers, resume attachment references, cover letters, application status, application notes, applicant review, and application activity.
- Emits notifications to candidates and employer-side users.
- Provides recruiting context used by `messaging` to authorize recruiter/company candidate conversations.

### `recruiting`

- Owns recruiter seats, hiring team access, saved candidates, talent pools, candidate notes, candidate source labels, and outreach permission checks.
- Uses company roles and billing/entitlement state to decide who can act as recruiter.
- Provides candidate outreach context to `messaging` without making `messaging` understand application or company internals.

### `connections`

- Owns connection requests, accepted connections, follows, blocks, relationship visibility, and graph lookups.
- Provides policy helpers for feed visibility and messaging permission.

### `posts`

- Owns user/company posts, comments, reactions, mentions, hashtags, media attachments, saved posts, hidden posts, and content visibility.
- Emits interaction events for notifications, search indexing, moderation, and feed update hints.

### `feed`

- Owns feed query composition, ranking hooks, visibility filters, cursor pagination, Redis feed hints, and profile/company/hashtag feeds.
- Does not own post creation; it reads from `posts`, `connections`, `companies`, and `profiles`.

### `messaging`

- Owns conversations, participants, messages, message attachments, read state, presence hints, and message authorization.
- Allows:
  - user-to-user conversations,
  - recruiter-to-candidate conversations,
  - company-admin/recruiter-to-candidate conversations with valid recruiting context.
- Blocks conversations when either side has blocked the other.

### `realtime`

- Owns WebSocket gateways for live message delivery, notification delivery, typing indicators, read receipts, and presence.
- Reads authorization from `auth`, `messaging`, and `notifications`; it does not own message or notification persistence.
- Uses Redis for presence and horizontal fan-out when multiple API instances run.

### `notifications`

- Owns notification records, unread state, preferences, notification fan-in, and read/read-all APIs.
- Source of truth is Postgres; Redis can cache unread counters.

### `email`

- Owns transactional email templates, send orchestration, delivery logs, and retry status.
- Handles password reset, application status changes, important messages, and notification digest later.

### `search`

- Owns search facade and indexing pipeline.
- Provides both:
  - Postgres fallback search for users, profiles, companies, jobs, and posts.
  - Elasticsearch index for richer search, filtering, ranking, typo tolerance, and cross-domain search.
- Domain modules emit index events; `search` owns indexing shape.

### `recommendations`

- Owns people-you-may-know, jobs-you-may-like, companies-to-follow, and feed ranking experiments.
- Starts simple using Postgres queries; later can consume search/index data.

### `analytics`

- Owns event-derived metrics such as profile views, company views, job views, post impressions, search queries, external apply clicks, and application funnel metrics.
- Consumes outbox events and writes aggregated counters separately from transactional domain tables.
- Provides company/admin analytics APIs without leaking private candidate data.

### `billing`

- Owns plan entitlements, recruiter seats, job posting credits, subscriptions, invoices, payment-provider references, and billing webhooks if paid plans are enabled.
- Starts as entitlement tracking even if payment collection is deferred.
- Exposes entitlement checks to `companies`, `jobs`, `recruiting`, and `messaging`.

### `moderation`

- Owns reports, block-enforced visibility, content status, moderation decisions, and safety workflows.
- Applies to posts, comments, messages, profiles, companies, and jobs.

### `admin`

- Owns internal admin APIs for account status, company verification, content reports, job takedowns, and operational lookups.
- Must be protected by explicit admin role checks.

### `audit`

- Owns audit logs for security-sensitive changes: auth events, role changes, company admin changes, job status changes, application status changes, moderation actions, and admin actions.

## Proposed Dependencies

Primary production dependencies, added in the phase that first needs them:

- `@nestjs/config` — environment config.
- `@nestjs/jwt` — JWT signing/verification.
- `@nestjs/throttler` — rate limits for auth, messaging, applications, and write-heavy endpoints.
- `@nestjs/throttler-storage-redis` or a custom Redis `ThrottlerStorage` — required so rate limits are global across API instances instead of in-memory per process.
- `@nestjs/schedule` — outbox polling, scheduled retries, and periodic maintenance tasks.
- `@nestjs/swagger` — OpenAPI documentation once route contracts stabilize.
- `@nestjs/terminus` — health, readiness, and dependency checks.
- `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` — realtime gateway support in Phase 8.
- `@prisma/client` — Prisma runtime.
- `ioredis` — Redis client.
- `bcryptjs` — password and token hashing without native build friction.
- `class-validator`, `class-transformer` — Nest DTO validation.
- `zod` — environment schema validation.
- `helmet` — secure HTTP headers.
- `cookie-parser` — refresh-token cookie parsing if refresh tokens are delivered through httpOnly cookies.
- `nestjs-pino`, `pino`, `pino-http` — structured JSON logs with request context and redaction.
- `@opentelemetry/sdk-node`, `@opentelemetry/api`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/exporter-metrics-otlp-http` — vendor-neutral telemetry.
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — S3-compatible media uploads.
- `@elastic/elasticsearch` — Elasticsearch client for the external search adapter.
- `nodemailer` — initial SMTP-compatible email adapter.

Primary dev dependencies:

- `prisma` — migrations/client generation.
- `@types/bcryptjs` — bcryptjs types if needed by the selected version.
- `@types/cookie-parser` — cookie-parser types if refresh-token cookies are enabled.
- `@types/nodemailer` — Nodemailer typing if needed by the selected version.

Avoid initially:

- `@nestjs/microservices`, BullMQ, Kafka/RabbitMQ, Kubernetes manifests, vendor-specific APM SDKs, Meilisearch, OpenSearch, GraphQL, and payment SDKs before billing requirements are locked.
- Revisit queues when the transactional outbox processor becomes too slow or needs independent scaling.
- Revisit OpenSearch only if deployment constraints require an Elasticsearch-compatible open-source alternative.

## Authorization Matrix

### Core Account & Profile Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Register account | Anonymous | valid email, password strength | `UserRegistered` → profile shell, audit log, email verification |
| Verify email | Token holder | valid unexpired token hash | `EmailVerified` → account trust update, audit log |
| Login | Registered user | correct password, account not suspended | `UserLoggedIn` → audit log, session created |
| Refresh token | Token holder | valid unexpired refresh token hash | `TokenRefreshed` → audit log, token rotation |
| Request password reset | Any user | valid email, rate limit | `PasswordResetRequested` → email delivery, audit log |
| Confirm password reset | Token holder | valid unexpired reset token hash | `PasswordResetConfirmed` → audit log, all sessions revoked |
| Update own account | User | `currentUser.id === targetUserId` | `UserUpdated` → audit log |
| Update profile | Profile owner, admin | profile ownership or admin role | `ProfileUpdated` → search index, audit log |
| View public profile | Any user or anonymous | profile visibility allows public read | `ProfileViewed` → analytics event |
| View private profile | Connection/network | connection graph + visibility rules | `ProfileViewed` → analytics event |

### Media & Storage Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Request upload intent | Authenticated user | account active, asset type allowed | `MediaIntentCreated` → pending asset record |
| Upload to storage | Intent holder | valid presigned URL, size/type limits | Direct S3 upload (no event) |
| Complete upload | Intent creator | asset ownership, metadata validation | `MediaAssetCompleted` → asset ready, scan hook |
| Download media | Asset owner or authorized viewer | ownership or public/shared access | No event (read-only) |
| Delete media | Asset owner, admin | ownership or admin role | `MediaAssetDeleted` → audit log, storage cleanup |

### Company Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Create company | Verified user | email verified, account active | `CompanyCreated` → audit log, search index, default entitlement |
| Update company | Company owner/admin, platform admin | company membership role | `CompanyUpdated` → search index, audit log |
| Add company member | Company owner/admin | admin role, target user exists | `CompanyMemberAdded` → notification, audit log |
| Update member role | Company owner/admin | admin role, cannot demote last owner | `CompanyMemberRoleChanged` → audit log, permission refresh |
| Remove company member | Company owner/admin | admin role, cannot remove last owner | `CompanyMemberRemoved` → notification, audit log |
| Follow company | Authenticated user | target visibility allows follow | `CompanyFollowed` → follower count update |
| Unfollow company | Follower | user is current follower | `CompanyUnfollowed` → follower count update |
| View company analytics | Company owner/admin/recruiter | company role, privacy-safe aggregation | No event (read-only) |

### Job & Application Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Create job | Company recruiter/admin/owner | company role, job posting credits | `JobCreated` → search index, follower notifications, audit log |
| Update job | Job creator, company admin, platform admin | company/job ownership | `JobUpdated` → search index, audit log |
| Publish job | Job creator, company admin | job draft state, company active | `JobPublished` → search index, follower notifications |
| Close job | Job creator, company admin | job published state | `JobClosed` → search index, applicant notifications |
| Delete job | Job creator, company admin, platform admin | company/job ownership | `JobDeleted` → search cleanup, audit log |
| Save job | Authenticated user | job visible to user | `JobSaved` → saved jobs list |
| Unsave job | Job saver | user saved this job | `JobUnsaved` → saved jobs list |
| Apply to job internally | Candidate user | job allows internal/hybrid, no active application, not company recruiter for same job | `ApplicationSubmitted` → company notification, candidate confirmation, recruiting context enabled, analytics funnel |
| Track external apply click | Candidate user or anonymous | job allows external/hybrid apply | `ExternalApplyClicked` → analytics event |
| View applications (candidate) | Application owner | user owns application | No event (read-only) |
| View applications (employer) | Company recruiter/admin/owner | company owns job | No event (read-only) |
| Review application | Company recruiter/admin/owner | company owns job | `ApplicationReviewed` → audit log |
| Update application status | Company recruiter/admin/owner | company owns job | `ApplicationStatusChanged` → candidate notification/email, audit log |
| Add application note | Company recruiter/admin/owner | company owns job, note is company-private | `ApplicationNoteAdded` → audit log |

### Recruiting Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Save candidate | Company recruiter/admin/owner | recruiter entitlement, candidate visibility allows recruiting | `CandidateSaved` → saved candidates list |
| Unsave candidate | Recruiter who saved | user saved this candidate | `CandidateUnsaved` → saved candidates list |
| Create talent pool | Company recruiter/admin/owner | recruiter entitlement | `TalentPoolCreated` → audit log |
| Add candidate to pool | Company recruiter/admin/owner | pool ownership, candidate visibility | `CandidateAddedToPool` → audit log |
| Remove candidate from pool | Company recruiter/admin/owner | pool ownership | `CandidateRemovedFromPool` → audit log |
| Add candidate note | Company recruiter/admin/owner | company recruiting access, note is company-private | `CandidateNoteAdded` → audit log |
| Check outreach permission | Company recruiter/admin/owner | application context OR talent pool OR candidate contact preference | No event (read-only policy check) |

### Connection & Network Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Send connection request | Authenticated user | no block relationship, not already connected, cannot self-connect | `ConnectionRequested` → recipient notification |
| Accept connection | Request recipient | user received this request | `ConnectionAccepted` → requester notification, feed relationship updated |
| Decline connection | Request recipient | user received this request | `ConnectionDeclined` → no notification |
| Remove connection | Either party | users are connected | `ConnectionRemoved` → feed relationship updated |
| Follow user | Authenticated user | target visibility allows follow, no block | `UserFollowed` → optional notification |
| Unfollow user | Follower | user is current follower | `UserUnfollowed` → no notification |
| Block user | Authenticated user | cannot self-block | `UserBlocked` → connection removed, messages hidden, feed filtered |
| Unblock user | Blocker | user blocked this target | `UserUnblocked` → no automatic reconnection |

### Post & Feed Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Create post | User or company admin | actor owns user identity or can post as company, verified email for public posts | `PostCreated` → feed visibility hints, search index, hashtag index, mention notifications |
| Update post | Post creator, platform admin | post ownership or admin role | `PostUpdated` → search index, audit log |
| Delete post | Post creator, platform admin | post ownership or admin role | `PostDeleted` → search cleanup, audit log |
| View post | Public/network/follower/company visibility | visibility rules + block checks | `PostViewed` → analytics event |
| Create comment | Authenticated user | post visible to user, no block | `CommentCreated` → post author notification, mention notifications |
| Update comment | Comment creator, platform admin | comment ownership or admin role | `CommentUpdated` → audit log |
| Delete comment | Comment creator, post creator, platform admin | ownership or admin role | `CommentDeleted` → audit log |
| Add reaction | Authenticated user | post visible to user, no block | `ReactionAdded` → post author notification |
| Remove reaction | Reaction creator | user created this reaction | `ReactionRemoved` → no notification |
| Save post | Authenticated user | post visible to user | `PostSaved` → saved posts list |
| Unsave post | Post saver | user saved this post | `PostUnsaved` → saved posts list |
| Hide post | Authenticated user | post visible to user | `PostHidden` → feed filtered |

### Messaging Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Create direct conversation | Authenticated user | no block relationship between participants | `ConversationCreated` → participant records |
| Create recruiting conversation | Recruiter/company admin | valid application/recruiting context, recruiter entitlement, candidate contact preference, no block | `RecruitingConversationCreated` → participant records, audit log |
| Send message | Conversation participant | participant membership, no block | `MessageSent` → recipient notification, unread counter, realtime event |
| Read conversation | Participant only | participant membership | No event (read-only) |
| Mark conversation read | Participant | participant membership | `ConversationRead` → unread counter update, read receipt |
| Add message attachment | Message sender | participant membership, media ownership | `MessageAttachmentAdded` → message record |

### Notification Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| View notifications | Notification owner | notification recipient | No event (read-only) |
| Mark notification read | Notification owner | notification recipient | `NotificationRead` → unread counter update |
| Mark all notifications read | Authenticated user | user owns notifications | `NotificationsReadAll` → unread counter reset |
| Update notification preferences | Authenticated user | user owns preferences | `NotificationPreferencesUpdated` → audit log |

### Search Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Search users/profiles | Any user or anonymous | results filtered by visibility + block | `SearchQueryLogged` → analytics event |
| Search companies | Any user or anonymous | results filtered by visibility | `SearchQueryLogged` → analytics event |
| Search jobs | Any user or anonymous | results filtered by visibility + status | `SearchQueryLogged` → analytics event |
| Search posts | Any user or anonymous | results filtered by visibility + block | `SearchQueryLogged` → analytics event |
| Trigger reindex (admin) | Platform admin | admin role, rate limited | `ReindexTriggered` → search rebuild, audit log |

### Moderation & Admin Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| Submit report | Authenticated user | content visible to user | `ReportCreated` → moderation queue, audit log |
| Review report | Admin/moderator | platform role | No event (read-only) |
| Take moderation action | Admin/moderator | platform role | `ModerationActionCreated` → content status update, audit log, reporter notification |
| Update user status (admin) | Platform admin | admin role | `UserStatusChanged` → audit log, session revocation if suspended |
| Verify company (admin) | Platform admin | admin role | `CompanyVerified` → audit log, search index |
| Update job status (admin) | Platform admin | admin role | `JobStatusChanged` → search index, audit log |

### Billing Operations

| Capability | Allowed actors | Required checks | Event flows |
| --- | --- | --- | --- |
| View billing | Company owner, billing admin, platform admin | company billing role or platform role | No event (read-only) |
| View entitlements | Company owner/admin/recruiter | company role | No event (read-only) |
| Create subscription | Company owner, billing admin | company billing role | `SubscriptionCreated` → entitlement grant, audit log |
| Update subscription | Company owner, billing admin | company billing role | `SubscriptionUpdated` → entitlement recalculation, audit log |
| Cancel subscription | Company owner, billing admin | company billing role | `SubscriptionCancelled` → entitlement revocation, audit log |
| Process payment webhook | Payment provider | valid webhook signature | `PaymentProviderEventReceived` → subscription/entitlement update, audit log |

## Core Data Model Roadmap

Add models through migrations in this order. Each phase must include indexes, unique constraints, and authorization tests.

### Phase 0 Models

- `User`
- `RefreshToken`
- `AuditLog`
- `OutboxEvent`
- `OutboxDeadLetter`
- `IdempotencyKey`

### Phase 1 Models

- `PasswordResetToken`
- `EmailVerificationToken`
- `UserPreference`
- `EmailDelivery`
- `EmailTemplate`
- `RateLimitAudit` or Redis-only rate-limit keys plus audit events

### Phase 2 Models

- `UserProfile`
- `Skill`
- `ProfileSkill`
- `Experience`
- `Education`
- `Certification`
- `Language`
- `Endorsement`
- `MediaAsset`
- `SearchSyncState`
- `SearchDocumentSnapshot`

### Phase 3 Models

- `Company`
- `CompanyMember`
- `CompanyFollower`
- `CompanyVerification`
- `CompanyMedia`
- `CompanyEntitlement`
- `RecruiterSeat`

### Phase 4 Models

- `Job`
- `JobSkill`
- `SavedJob`
- `JobView`
- `Application`
- `ApplicationAnswer`
- `ApplicationAttachment`
- `ApplicationStatusEvent`
- `ApplicationNote`
- `SavedCandidate`
- `TalentPool`
- `TalentPoolCandidate`
- `CandidateNote`
- `CandidateSource`
- `Notification`

### Phase 5 Models

- `Connection`
- `Follow`
- `Block`

### Phase 6 Models

- `Post`
- `PostAttachment`
- `Comment`
- `Reaction`
- `Mention`
- `Hashtag`
- `PostHashtag`
- `SavedPost`
- `HiddenPost`

### Phase 7 Models

- `Conversation`
- `ConversationParticipant`
- `Message`
- `MessageAttachment`
- `MessageReadState`

### Phase 8 Models

- `NotificationPreference`
- `RealtimeDeliveryReceipt`
- `UserDevice`

### Phase 9 Models

- `SearchIndexTask`
- `SearchQueryLog`
- `SearchReindexRun`

### Phase 10 Models

- `RecommendationFeedback`
- `RecommendationDismissal`

### Phase 11 Models

- `Report`
- `ModerationAction`
- `ContentStatus`
- `AdminAction`
- `ProfileView`
- `CompanyView`
- `PostImpression`
- `PostEngagement`
- `AnalyticsDailyAggregate`

### Phase 12 Models

- `BillingPlan`
- `CompanySubscription`
- `Invoice`
- `JobPostingCredit`
- `EntitlementGrant`
- `PaymentProviderEvent`

Important constraints:

- Store password hashes only; never store plaintext passwords.
- Store refresh tokens and password reset tokens hashed, with expiration and revocation fields.
- Use UUID primary keys for externally exposed IDs unless a specific domain requires short slugs.
- Use unique constraints for `email`, profile slug if introduced, duplicate applications, duplicate reactions, duplicate connection pairs, duplicate follows, duplicate blocks, and duplicate company memberships.
- Index feed/search/job/application paths early: `createdAt`, owner IDs, applicant IDs, company IDs, status fields, visibility fields, connection statuses, and search vector fields.
- Treat Postgres as source of truth. Redis, Elasticsearch, S3 objects, email delivery state, and analytics aggregates are derived or operational systems.
- Use soft-delete or status fields for user-generated/product-critical records where auditability matters: users, profiles, companies, jobs, applications, posts, comments, messages, reports, and billing records.
- Prefer status enums over `deletedAt` when a user may recreate the same relationship later, such as follows, blocks, connections, saved jobs, and saved posts.
- When a soft-deleted table still needs uniqueness only among active records, document and create a Postgres partial unique index through a raw SQL migration because Prisma schema-level `@@unique` does not express `WHERE deleted_at IS NULL`.
- Keep Postgres foreign keys enabled by default for relational integrity; if a later phase chooses Prisma-only relation handling, record the reason and add compensating service-level integrity tests.

## API Surface Roadmap

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`

### Users & Profiles

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/:id`
- `GET /profiles/me`
- `PATCH /profiles/me`
- `GET /profiles/:id`
- `POST /profiles/me/skills`
- `DELETE /profiles/me/skills/:id`
- `POST /profiles/me/experience`
- `PATCH /profiles/me/experience/:id`
- `DELETE /profiles/me/experience/:id`
- `POST /profiles/me/education`
- `PATCH /profiles/me/education/:id`
- `DELETE /profiles/me/education/:id`

### Media

- `POST /media/upload-intents`
- `POST /media/:id/complete`
- `GET /media/:id`
- `DELETE /media/:id`

### Companies

- `POST /companies`
- `GET /companies`
- `GET /companies/:id`
- `PATCH /companies/:id`
- `POST /companies/:id/members`
- `PATCH /companies/:id/members/:memberId`
- `DELETE /companies/:id/members/:memberId`
- `POST /companies/:id/follow`
- `DELETE /companies/:id/follow`

### Jobs & Applications

- `POST /jobs`
- `GET /jobs`
- `GET /jobs/:id`
- `PATCH /jobs/:id`
- `DELETE /jobs/:id`
- `POST /jobs/:id/save`
- `DELETE /jobs/:id/save`
- `GET /jobs/saved`
- `POST /jobs/:id/apply`
- `POST /jobs/:id/external-apply-clicks`
- `GET /applications/me`
- `GET /jobs/:id/applications`
- `GET /applications/:id`
- `PATCH /applications/:id/status`
- `POST /applications/:id/notes`

### Recruiting

- `GET /recruiting/candidates`
- `POST /recruiting/candidates/:profileId/save`
- `DELETE /recruiting/candidates/:profileId/save`
- `POST /recruiting/talent-pools`
- `GET /recruiting/talent-pools`
- `POST /recruiting/talent-pools/:id/candidates`
- `DELETE /recruiting/talent-pools/:id/candidates/:candidateId`
- `POST /recruiting/candidates/:profileId/notes`
- `GET /recruiting/candidates/:profileId/notes`
- `POST /recruiting/candidates/:profileId/outreach-check`

### Connections

- `POST /connections`
- `GET /connections`
- `GET /connections/pending`
- `PATCH /connections/:id/accept`
- `PATCH /connections/:id/decline`
- `DELETE /connections/:id`
- `POST /users/:id/follow`
- `DELETE /users/:id/follow`
- `POST /users/:id/block`
- `DELETE /users/:id/block`

### Posts & Feed

- `POST /posts`
- `GET /posts/:id`
- `PATCH /posts/:id`
- `DELETE /posts/:id`
- `POST /posts/:id/comments`
- `PATCH /comments/:id`
- `DELETE /comments/:id`
- `POST /posts/:id/reactions`
- `DELETE /posts/:id/reactions/:reactionId`
- `POST /posts/:id/save`
- `DELETE /posts/:id/save`
- `GET /feed/home`
- `GET /feed/profile/:userId`
- `GET /feed/company/:companyId`
- `GET /feed/hashtag/:tag`

### Messaging

- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:id`
- `POST /conversations/:id/messages`
- `GET /conversations/:id/messages`
- `PATCH /conversations/:id/read`
- `POST /conversations/recruiting`

### Realtime

- `WS /realtime`
- `SUBSCRIBE user.notifications`
- `SUBSCRIBE user.messages`
- `SUBSCRIBE conversation.:id`
- `EMIT typing.started`
- `EMIT typing.stopped`
- `EMIT message.read`

### Notifications & Email

- `GET /notifications`
- `PATCH /notifications/:id/read`
- `POST /notifications/read-all`
- `GET /notifications/preferences`
- `PUT /notifications/preferences`
- `GET /email/deliveries/me`

### Search & Recommendations

- `GET /search`
- `GET /search/users`
- `GET /search/companies`
- `GET /search/jobs`
- `GET /search/posts`
- `POST /search/reindex` admin-only
- `GET /recommendations/people`
- `GET /recommendations/jobs`
- `GET /recommendations/companies`

### Analytics

- `GET /analytics/me/profile-views`
- `GET /analytics/companies/:companyId`
- `GET /analytics/jobs/:jobId`
- `GET /analytics/posts/:postId`

### Billing & Entitlements

- `GET /billing/plans`
- `GET /companies/:companyId/billing`
- `POST /companies/:companyId/subscription`
- `GET /companies/:companyId/entitlements`
- `POST /billing/webhooks/:provider`

### Moderation & Admin

- `POST /reports`
- `GET /admin/reports`
- `PATCH /admin/reports/:id`
- `GET /admin/users`
- `PATCH /admin/users/:id/status`
- `GET /admin/companies`
- `PATCH /admin/companies/:id/verification`
- `GET /admin/jobs`
- `PATCH /admin/jobs/:id/status`

## Event Flows

Use transactional outbox events in the monolith. Each event must be typed, persisted in the same transaction as the domain write, processed idempotently, and tested at the service/processor level.

- `UserRegistered` → create profile shell, audit log, email verification event, search placeholder.
- `EmailVerificationRequested` → create email delivery record, send verification email.
- `EmailVerified` → audit log, account trust state update, optional welcome email.
- `PasswordResetRequested` → create email delivery record, send reset email.
- `ProfileUpdated` → update Postgres search fields, Elasticsearch index, analytics activity.
- `MediaAssetCompleted` → attach media metadata, update owning domain if needed, scan/quarantine hook.
- `CompanyCreated` → audit log, Elasticsearch index, default entitlement grant if configured.
- `CompanyMemberChanged` → audit log, notification.
- `RecruiterSeatChanged` → entitlement audit log, messaging permission refresh.
- `JobPublished` → search index, company follower notification candidate, audit log.
- `ApplicationSubmitted` → company notification, candidate notification, audit log, recruiting context enabled, analytics funnel event.
- `ApplicationStatusChanged` → candidate notification/email, audit log.
- `ConnectionRequested` → recipient notification.
- `ConnectionAccepted` → requester notification, feed relationship updated.
- `PostCreated` → feed visibility hints, search index, hashtag index, mention notifications.
- `PostViewed` / `PostInteracted` → analytics aggregate, author notification when applicable.
- `MessageSent` → recipient notification, unread counter, realtime event, optional email digest later.
- `NotificationCreated` → unread counter update, realtime delivery if recipient is online.
- `ReportCreated` → moderation queue, audit log.
- `ModerationActionCreated` → content status update, audit log.
- `BillingEntitlementChanged` → company/recruiter permission refresh and audit log.

## Configuration Design

- Only `src/infra/config` may read `process.env` directly.
- Validate all environment variables at startup with `zod`; invalid config fails startup before the app listens.
- Split config into typed groups: `app`, `auth`, `database`, `redis`, `storage`, `elasticsearch`, `email`, `observability`, `cors`, `rateLimit`, and `billing`.
- Commit `.env.example` with safe placeholders only; never commit real `.env` files.
- Keep environment-specific values in deployment environments/secrets, not in code.
- Support `APP_PROCESS_ROLE=api|worker|realtime|all` and `NODE_ENV=development|test|production`.
- Add config tests that load `.env.example` and assert required keys are documented.
- Define request body limits in config, with conservative defaults such as `JSON_BODY_LIMIT=1mb` and `URLENCODED_BODY_LIMIT=1mb`; file bytes must go through S3 presigned uploads, not JSON bodies.
- Define database pool guidance in config docs. Total possible Postgres connections are approximately `DATABASE_CONNECTION_LIMIT × running process instances`; introduce PgBouncer or reduce per-process limits before approaching Postgres `max_connections`.
- Decide and pin the Elasticsearch Docker image/client major version before installing dependencies or writing `docker-compose.yml`; the Docker image and `@elastic/elasticsearch` client must use compatible major versions.

## API Contract Design

- Prefix public REST APIs with `/api/v1` from Phase 0.
- Success response shape: `{ "data": T, "meta"?: { ... } }`.
- Paginated response shape: `{ "data": T[], "meta": { "nextCursor"?: string, "hasMore": boolean } }`.
- Error response shape: `{ "error": { "code": string, "message": string, "details"?: unknown, "requestId"?: string } }`.
- Dates in responses are ISO 8601 UTC strings.
- Public DTOs must not expose `passwordHash`, token hashes, reset tokens, provider secrets, internal search documents, private notes, raw resume text, or full private message bodies.

## CI/CD Design

- Use GitHub Actions for three workflows:
  - `ci.yml` on pull requests and pushes to `main`.
  - `security.yml` for dependency review, CodeQL if enabled, secret scanning support, and `npm audit --audit-level=high`.
  - `deploy.yml` for environment-protected staging/production deploys.
- CI jobs:
  1. checkout,
  2. setup Node with npm cache,
  3. `npm ci`,
  4. Prisma validate/generate,
  5. lint,
  6. typecheck,
  7. unit tests,
  8. build,
  9. e2e/integration tests with Postgres, Redis, MinIO, and Elasticsearch services.
- Deployment jobs:
  1. build production container image,
  2. push image to registry,
  3. run `prisma migrate deploy` as a protected migration job,
  4. deploy API/worker/realtime roles using the same image,
  5. run post-deploy smoke checks against `/health/live`, `/health/ready`, and root/version endpoint.
- Use least-privilege `permissions` in every workflow. Only deploy jobs should request `id-token: write` for OIDC cloud authentication.
- Use GitHub Environments for `staging` and `production`, with required reviewers for production.
- Prefer pinned action versions; for higher security later, pin third-party actions by commit SHA.
- Do not run production deploys from pull requests.

## Deployment and Runtime Design

- Build one multi-stage Docker image from the Nest app.
- Runtime command reads `APP_PROCESS_ROLE`:
  - `api` starts HTTP controllers and no outbox processors,
  - `worker` starts outbox/scheduled processors and no public HTTP listener except health if required by platform,
  - `realtime` starts WebSocket gateway and required auth/notification dependencies,
  - `all` starts everything for local development.
- Keep deploys stateless. Durable state lives in Postgres, Redis, S3, Elasticsearch, and provider systems.
- Use expand/contract database changes for backward-compatible deploys. Avoid destructive migrations in the same deploy that removes code.
- Rollback strategy: rollback application image first; database rollback is forward-fix unless a migration is explicitly reversible and verified.
- Add runbooks for deploy, rollback, migration failure, outbox backlog, Elasticsearch outage, S3 outage, and Redis outage.

## Logging Design

- Use structured JSON logs through `nestjs-pino`/Pino.
- Every request log includes request ID, trace ID, method, route, status, latency, user ID when authenticated, and safe actor/company context where useful.
- Every outbox processor log includes event ID, event type, attempt, lease owner, duration, and result.
- Redact authorization headers, cookies, passwords, access tokens, refresh tokens, reset tokens, S3 credentials, payment secrets, resumes, full message bodies, and private candidate notes.
- Do not log raw request bodies by default. Log validated DTO summaries only when explicitly safe.
- Log levels:
  - `debug` local only,
  - `info` normal business/operational events,
  - `warn` retryable degradation,
  - `error` failed requests/processors,
  - `fatal` startup/config failures.

## Observability Design

- Use OpenTelemetry as the instrumentation layer for traces and metrics.
- Required traces as dependencies are introduced: HTTP requests, Prisma/database calls, Redis calls, S3 calls, Elasticsearch calls, email sends, outbox processor attempts, and WebSocket message flow.
- Required metrics:
  - HTTP request count/latency/error rate,
  - process CPU/memory,
  - Prisma query latency,
  - Redis latency/errors,
  - Elasticsearch query/index latency/errors,
  - S3 upload completion/failure counts,
  - outbox pending count, oldest pending age, retry count, dead-letter count,
  - email delivery success/failure,
  - notification unread counter drift,
  - realtime connection count and delivery failures.
- Health endpoints:
  - `/health/live` checks process liveness only,
  - `/health/ready` checks Postgres, Redis, S3, Elasticsearch, and critical config,
  - `/health/startup` checks bootstrapping/migration readiness when the platform supports startup probes.
- Dashboards should be organized by role: API, worker, realtime, database, search, storage, and product funnel.
- Alerts should page only for user-impacting symptoms: elevated 5xx, high latency, readiness failure, outbox backlog age, dead-letter growth, failed migrations, Elasticsearch unavailable with high search traffic, S3 upload failures, and email failure spikes.

## Microservice Extraction Strategy

- Do not extract services until there is a measurable reason: independent scaling, team ownership, deployment cadence, isolation/security boundary, or hard performance bottleneck.
- Candidate extraction order:
  1. `search` worker/indexer,
  2. `media` processing/scanning,
  3. `notifications`/`email` delivery,
  4. `messaging`/`realtime`,
  5. `feed` generation,
  6. `analytics`,
  7. `billing`.
- Before extracting a module, it must have:
  - clear owner tables,
  - exported service interface,
  - no imports from another module's private files,
  - outbox events for side effects,
  - idempotent consumers,
  - contract/e2e tests,
  - observability metrics,
  - data migration plan,
  - fallback/degradation behavior.
- Extraction path:
  1. keep existing module as facade,
  2. introduce client adapter behind the same interface,
  3. run local/in-process implementation by default,
  4. switch selected environment to remote implementation,
  5. migrate ownership/data access,
  6. remove direct database reads only after parity is verified.
- Never split by technical layer such as controllers/services/repositories. Split by business capability and data ownership.

## Future Nest Monorepo Microservices Layout

- Keep Phase 0 as one Nest app with modular domain folders. Do not start with `apps/*` microservices until a specific extraction trigger exists.
- When extraction is justified, convert toward a Nest monorepo shape:
  ```text
  apps/
    api-gateway/
    worker/
    realtime-gateway/
    search-service/
    media-service/
    messaging-service/
    notifications-service/
  libs/
    contracts/
    common/
    config/
    observability/
    database/
    domain-events/
  ```
- `libs/contracts` owns API/event contracts, not business implementation.
- `libs/common` owns primitives only: errors, pagination, guards/decorators, testing helpers.
- `libs/database` must not become a shared write-model dumping ground. Extracted services should own their data access or expose query APIs.
- `api-gateway` should orchestrate public HTTP/WebSocket contracts, but domain rules remain in the owning service/module.
- Prefer replacing in-process providers with client adapters behind the same interface before moving files into `apps/*`.

## Search Design

- Postgres search is mandatory fallback for users, profiles, companies, jobs, and posts.
- Elasticsearch is mandatory for product search and should be wrapped behind `SearchEngineService`.
- Use Elasticsearch as the external search engine from the beginning for richer filtering, ranking, cross-domain search, and future analytics/search tuning.
- Keep search documents denormalized and explicitly versioned.
- Domain modules write outbox index events; `search` performs indexing.
- Use index aliases such as `profiles_current`, `companies_current`, `jobs_current`, and `posts_current` so reindexing can create versioned backing indexes and swap aliases safely.
- Store `schemaVersion`, `sourceId`, `sourceType`, `visibility`, `updatedAt`, and authorization-relevant fields in every search document.
- If Elasticsearch is unavailable, read endpoints must degrade to Postgres search rather than fail product-critical paths.
- Admin reindex endpoint must be protected and rate-limited.
- Search results must be filtered again by application policy before returning private profiles, blocked users, hidden posts, unpublished jobs, or restricted company data.

## Media Design

- Use S3-compatible object storage from Phase 0.
- Local development should run MinIO through Docker Compose; production should use AWS S3 or compatible provider.
- Upload flow:
  1. Client requests upload intent.
  2. Backend creates `MediaAsset` in pending state.
  3. Backend returns presigned upload URL.
  4. Client uploads to S3.
  5. Client calls complete endpoint.
  6. Backend verifies metadata and marks asset complete.
- Store object keys, bucket, content type, size, checksum if available, owner ID, purpose, and status.
- Do not expose raw permanent S3 object URLs unless assets are intentionally public.
- Model media status as `PENDING`, `READY`, `QUARANTINED`, `DELETED`; actual malware scanning can start as a stub but the state machine must exist from Phase 2.
- Enforce per-purpose size/type limits: avatar/logo image, resume document, post attachment, and message attachment should not share unrestricted upload rules.
- Use private buckets by default with public access blocked. Public assets should be served through controlled signed URLs or a future CDN policy, not by making the whole bucket public.
- Generate random object keys; never trust user-provided filenames as storage keys.
- Persist original filename only as metadata after sanitization.
- Verify upload completion server-side with `HeadObject` or equivalent metadata checks before marking media `READY`.
- Require server-side encryption for production buckets.
- Include media-specific observability: upload intent count, completion count, quarantine count, delete count, S3 errors, and orphaned pending assets.

## Feed Design

- Feed supports public posts, connection-visible posts, follower-visible posts, company posts, hashtag feeds, profile feeds, and company feeds.
- First implementation should query Postgres with proper indexes and cursor pagination.
- Redis may cache feed hints, unread counters, and hot post metadata, but Postgres remains source of truth.
- Public feed/profile/company/job reads can be anonymous, but personalized home feed requires authentication.
- Ranking can start simple:
  1. own posts,
  2. accepted connections,
  3. followed users,
  4. followed companies,
  5. hashtag/company relevance,
  6. recency.
- Always enforce block and visibility filters at query time.
- Record impressions through analytics outbox events asynchronously; feed reads must not block on analytics writes.

## Messaging Design

- Conversation types:
  - `DIRECT_USER`
  - `RECRUITING`
  - `COMPANY_CANDIDATE`
- Direct user conversations require active users and no block relationship.
- Recruiting/company candidate conversations require one of:
  - candidate applied to a job owned by the company,
  - recruiter/company admin has company role and candidate profile permits recruiter contact,
  - candidate is saved in an authorized talent pool and candidate visibility allows outreach,
  - platform admin override for support/moderation.
- Message reads are per participant.
- Message attachments must reference `MediaAsset`.
- REST endpoints ship first; WebSocket delivery is implemented later through `realtime` without changing message persistence.
- Message creation must be idempotent through client-provided idempotency keys to avoid duplicate messages on retries.

## Outbox Design

- Domain services write business data and `OutboxEvent` rows in the same Prisma transaction.
- Processors lease due events, execute side effects, store attempt/error metadata, and mark events complete.
- Failed events retry with bounded exponential backoff, then move to dead-letter state for admin review.
- Processors must use idempotency keys derived from event ID plus target system, such as `email:ApplicationStatusChanged:<eventId>` or `search:Job:<jobId>:<version>`.
- Planned processors: search indexer, email sender, notification creator, audit writer, analytics aggregator, realtime dispatcher. Add each processor when its owning module lands.
- The monolith may run with `APP_PROCESS_ROLE=api`, `worker`, `realtime`, or `all` so local development stays simple while production can split runtime roles.
- Add scheduled cleanup for idempotency records and completed operational rows. Default target: retain idempotency keys for 30 days unless a longer compliance window is required.

## Data Retention Design

- Soft-delete or status changes preserve auditability, but they do not automatically satisfy privacy deletion requirements.
- User deletion must become an anonymization workflow: remove or anonymize personal profile fields, private contact data, resumes, avatars, message display names where appropriate, analytics identifiers, and search documents while preserving legally required audit/payment records.
- Schema design should separate user-generated business records from personally identifying fields so later GDPR/CCPA-style deletion can be implemented without destructive table rewrites.
- Add the first admin/anonymization workflow in Phase 11 unless legal or product requirements require it earlier.

## Realtime Design

- REST remains the source of truth. WebSockets only deliver already-authorized state changes and lightweight presence/typing signals.
- Socket authentication uses the same JWT access token flow as REST.
- Redis stores presence TTLs and pub/sub fan-out for multi-instance delivery.
- Realtime channels must be scoped to authenticated user IDs and conversation IDs; clients cannot subscribe to arbitrary company/user channels without policy checks.
- If realtime delivery fails, users still receive persisted messages and notifications through REST polling.

## Analytics Design

- Analytics is asynchronous and derived from outbox/events, not part of core write transactions.
- Track profile views, company views, job views, post impressions, search queries, external apply clicks, application funnel transitions, and message delivery/read metrics.
- Company analytics must use aggregate counts and privacy-safe thresholds; do not expose individual candidate behavior unless the user explicitly performed a company-facing action such as applying.
- Admin analytics can include operational metrics but must avoid leaking secrets, tokens, resumes, or full message bodies.

## Entitlements and Billing Design

- Entitlements should exist before payment collection so recruiter seats, job posting credits, and company capabilities can be enforced consistently.
- Billing starts provider-agnostic with internal plans, grants, subscriptions, invoices, and entitlement checks.
- Payment-provider integration is a later phase; when added, provider webhooks write immutable `PaymentProviderEvent` records before updating subscriptions or entitlements.
- Product code should check entitlements, not payment provider state directly.

## Phases

### Phase 0: Foundation, Infrastructure, and Baseline Contracts

Effort: **L**, but must be executed as three smaller sub-slices. **Do not implement all Phase 0 in one build pass.**

#### Phase 0A: Repo Baseline and Core Infra

Effort: **M**. This is the immediate next implementation target.

**Objectives**:
- Establish TypeScript strictness and build pipeline
- Add Prisma with foundational tables (User, RefreshToken, AuditLog, OutboxEvent, OutboxDeadLetter, IdempotencyKey)
- Add infrastructure services (config, Prisma, Redis, health checks)
- Add common primitives (validation, API envelope, pagination, auth decorators)
- Add structured logging with redaction and request correlation
- Add CI workflow for pull request validation
- Establish safe bootstrap with security headers and body limits

**Tasks**:
- Add Phase 0A dependencies: `@nestjs/config`, `@prisma/client`, `prisma`, `ioredis`, `class-validator`, `class-transformer`, `zod`, `helmet`, `nestjs-pino`, `pino`, `pino-http`
- Add scripts: `typecheck`, `prisma:validate`, `prisma:generate`, `prisma:migrate`, test database setup
- Tighten TypeScript: set `noImplicitAny: true`, `strictBindCallApply: true`, fix starter code
- Add `.env.example` with safe placeholders for all required config
- Add Docker Compose for Postgres 16 and Redis 7 (defer MinIO and Elasticsearch to Phase 0B)
- Add Prisma schema with foundational tables and first migration
- Add `InfraModule`: typed config with Zod validation, PrismaService, RedisService
- Add health endpoints: `/health/live` (process liveness), `/health/ready` (Postgres + Redis)
- Add `CommonModule`: global validation pipe, API response envelope (`{ data, meta? }`), error envelope (`{ error: { code, message, details?, requestId? } }`), cursor pagination types, `@CurrentUser` decorator placeholder, `@Public` decorator placeholder
- Add structured logging: Pino with request ID correlation, redaction rules for `authorization`, `cookie`, `password`, `token` fields
- Add safe bootstrap in `src/main.ts`: global validation pipe, `/api/v1` prefix, CORS from config, `JSON_BODY_LIMIT=1mb`, `URLENCODED_BODY_LIMIT=1mb`, Helmet security headers
- Add CI workflow (`.github/workflows/ci.yml`): checkout, setup Node with cache, `npm ci`, Prisma validate/generate, lint, typecheck, unit tests, build, e2e tests with Postgres/Redis services
- Keep root `GET /` smoke route working for backward compatibility

**Acceptance Criteria**:
- ✅ `npm install` completes without errors
- ✅ `npx prisma validate` passes
- ✅ `npx prisma generate` creates Prisma client
- ✅ `npm run typecheck` passes with strict TypeScript
- ✅ `npm run build` produces `dist/` output
- ✅ `npm run lint` passes
- ✅ `npm test` passes (unit tests)
- ✅ `npm run test:e2e` passes with Postgres/Redis services
- ✅ Docker Compose starts Postgres and Redis successfully
- ✅ `GET /health/live` returns 200
- ✅ `GET /health/ready` returns 200 when Postgres and Redis are healthy, 503 when either is down
- ✅ One HTTP request produces structured JSON log with `requestId`, `method`, `url`, `statusCode`, `responseTime`
- ✅ Authorization header is redacted in logs
- ✅ CI workflow runs successfully on pull request (all jobs pass)
- ✅ API responses follow envelope format: success `{ data }`, error `{ error: { code, message, requestId } }`

#### Phase 0B: Operational Adapters

Effort: **M**. Start only after Phase 0A passes.

**Objectives**:
- Add S3-compatible storage adapter (MinIO for local, S3 for production)
- Add Elasticsearch client wrapper with version pinning
- Add SMTP/Nodemailer mail adapter stub
- Add OpenTelemetry bootstrap for traces and metrics
- Add search facade for Postgres fallback + Elasticsearch indexing

**Tasks**:
- Pin Elasticsearch version: Docker image `elasticsearch:8.11.0`, client `@elastic/elasticsearch@8.11.0`
- Add Phase 0B dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@elastic/elasticsearch@8.11.0`, `nodemailer`, `@types/nodemailer`, `@opentelemetry/sdk-node`, `@opentelemetry/api`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/exporter-metrics-otlp-http`
- Add MinIO to Docker Compose (port 9000, console 9001)
- Add Elasticsearch 8.11.0 to Docker Compose with single-node config, security disabled for local dev
- Add S3Service wrapper with presigned URL generation, HeadObject verification
- Add SearchEngineService wrapper for Elasticsearch client, connection health check
- Add MailService adapter with Nodemailer SMTP transport, send stub
- Add OpenTelemetry bootstrap in `src/main.ts`: traces, metrics, auto-instrumentation for HTTP/Prisma/Redis
- Add health checks for S3 (bucket access), Elasticsearch (cluster health), mail (connection check)
- Add minimal `SearchModule` facade with Postgres fallback query helpers and Elasticsearch index/query stubs

**Acceptance Criteria**:
- ✅ Docker Compose starts Postgres, Redis, MinIO, and Elasticsearch 8.11.0 successfully
- ✅ `GET /health/ready` includes S3, Elasticsearch, and mail adapter health
- ✅ S3Service can generate presigned upload URL and verify object metadata
- ✅ SearchEngineService can connect to Elasticsearch and check cluster health
- ✅ MailService can verify SMTP connection (stub, no actual send required)
- ✅ One HTTP request emits OpenTelemetry trace span
- ✅ One HTTP request emits OpenTelemetry metric (http.server.duration)
- ✅ Elasticsearch version is pinned in `docker-compose.yml` and `package.json` (no `latest` tags)

#### Phase 0C: Outbox, Runtime Roles, and Automation Skeleton

Effort: **M**. Start only after Phase 0B passes.

**Objectives**:
- Add transactional outbox for durable event processing
- Add runtime role separation (api/worker/realtime/all)
- Add container build and CI/CD workflow skeletons
- Add architecture documentation and runbook placeholders

**Tasks**:
- Add `@nestjs/schedule` dependency for outbox polling
- Add `OutboxModule`: OutboxService for event persistence, processor skeleton with lease/retry/dead-letter logic, idempotency key helpers, scheduled cleanup for old idempotency records
- Add `APP_PROCESS_ROLE` environment variable support: `api` (HTTP only), `worker` (processors only), `realtime` (WebSocket only), `all` (everything for local dev)
- Add `Dockerfile` with multi-stage build: install, build, production image with Node 20 Alpine
- Add `.dockerignore` to exclude `node_modules`, `.git`, `dist`, `.env`
- Add security workflow skeleton (`.github/workflows/security.yml`): dependency review on PRs, `npm audit --audit-level=high`, CodeQL placeholder
- Add deploy workflow skeleton (`.github/workflows/deploy.yml`): build image, push to registry, migration gate, deploy API/worker/realtime, smoke tests
- Add `docs/architecture.md` with ADR template, module boundary rules, extraction readiness checklist
- Add `docs/runbooks/` with placeholders for deployment, rollback, migration failure, outbox backlog, incident response
- Keep root `GET /` smoke route working

**Acceptance Criteria**:
- ✅ OutboxService can persist event in same transaction as domain write
- ✅ Outbox processor can lease due events, process them, mark complete
- ✅ Outbox processor retries failed events with exponential backoff
- ✅ Outbox processor moves events to dead-letter after max retries
- ✅ Outbox processor is idempotent (processing same event twice produces same result)
- ✅ Idempotency cleanup job removes records older than 30 days
- ✅ App starts successfully with `APP_PROCESS_ROLE=api` (no processors running)
- ✅ App starts successfully with `APP_PROCESS_ROLE=worker` (processors running, no HTTP listener except health)
- ✅ App starts successfully with `APP_PROCESS_ROLE=all` (everything running)
- ✅ Docker image builds successfully
- ✅ Docker container starts and responds to health checks
- ✅ CI workflow includes all Phase 0A checks plus container build
- ✅ Security workflow runs `npm audit` and dependency review
- ✅ Deploy workflow skeleton exists with environment protection placeholders

### Phase 1: Auth, Users, Preferences, and Audit Baseline

Effort: **L**.

**Objectives**:
- Implement complete authentication flow with email verification
- Add user account management and preferences
- Add email delivery for transactional emails
- Add audit logging for security-sensitive events
- Add rate limiting for auth endpoints

**Tasks**:
- Add `@nestjs/jwt`, `@nestjs/throttler`, `@nestjs/throttler-storage-redis`, `bcryptjs`, `@types/bcryptjs` dependencies
- Add Prisma models: `PasswordResetToken`, `EmailVerificationToken`, `UserPreference`, `EmailDelivery`, `EmailTemplate`
- Add `AuthModule`: register, email verification (request/resend/confirm), login, refresh, logout, password reset (request/confirm)
- Hash passwords with bcryptjs (cost factor 10)
- Hash refresh tokens, email verification tokens, and password reset tokens before storage
- Add account status enum: `UNVERIFIED`, `ACTIVE`, `SUSPENDED`, `DELETED`
- Gate high-trust actions behind verified email: company creation, job posting, recruiter outreach, public posting
- Add Redis-backed rate limits: register (5/hour per IP), login (10/minute per IP), password reset (3/hour per email)
- Add `@CurrentUser()` decorator and `AuthGuard` for protected routes
- Add `UsersModule`: user CRUD, user preferences, identity lookup
- Add `EmailModule`: SMTP adapter, email delivery records, password reset email template
- Add `AuditModule`: audit log service, auth event logging (register, login, logout, password reset, email verification)
- Emit outbox events: `UserRegistered`, `EmailVerificationRequested`, `EmailVerified`, `PasswordResetRequested`, `PasswordResetConfirmed`

**Acceptance Criteria**:
- ✅ User can register with email/password
- ✅ Registration creates unverified account and sends verification email event
- ✅ User cannot perform high-trust actions (create company, post job) until email verified
- ✅ User can verify email with valid token
- ✅ User can resend verification email (rate limited)
- ✅ User can login with correct credentials
- ✅ Login fails with incorrect password (no user enumeration)
- ✅ Login returns access token (JWT) and refresh token
- ✅ User can refresh access token with valid refresh token
- ✅ Refresh token is rotated on each refresh
- ✅ User can logout (refresh token invalidated)
- ✅ User can request password reset
- ✅ Password reset email is sent (outbox event processed)
- ✅ User can confirm password reset with valid token
- ✅ Password reset invalidates all existing sessions
- ✅ Rate limits prevent brute force (register, login, password reset)
- ✅ Passwords are hashed (never stored plaintext)
- ✅ Tokens are hashed before storage
- ✅ Auth events are logged to audit log
- ✅ Protected routes require valid JWT
- ✅ Protected routes return 401 for missing/invalid token
- ✅ High-trust actions return 403 for unverified users
- ✅ Unit tests for token hashing, login failure, refresh rotation
- ✅ E2E test: register → verify → login → protected route → refresh → logout
- ✅ E2E test: unverified user receives 403 for high-trust action
- ✅ E2E test: password reset happy path and invalid/expired token path

### Phase 2: Profiles, S3 Media, and Search Foundation

Effort: **XL**.

- Add `profiles` and `media`.
- Implement profile CRUD, skills, experience, education, certifications, languages, endorsements, visibility.
- Implement S3 upload intents and complete flow.
- Support avatars and resumes.
- Implement media status lifecycle: pending, ready, quarantined, deleted.
- Index profile data in Postgres search and Elasticsearch through `search`.

Verification:

- E2E profile create/update/read permissions.
- E2E S3 upload intent authorization and media completion.
- E2E profile search via Postgres fallback and Elasticsearch.

### Phase 3: Companies and Base Entitlements

Effort: **L**.

- Add `companies` and base entitlement checks.
- Implement company page CRUD, company logo media, company members, roles, followers, and verification placeholder.
- Implement recruiter seat records and company entitlement placeholders without payment collection.
- Add company admin policies for later jobs/messaging.
- Index companies in Postgres and Elasticsearch.

Verification:

- E2E company owner creates company, adds member, updates role.
- E2E non-admin receives 403 for protected company changes.
- E2E follow/unfollow company.
- E2E company entitlement/recruiter seat policy checks.

### Phase 4: Jobs, Applications, Recruiting, and Notification Baseline

Effort: **XL**.

- Add `jobs`, `applications`, `recruiting`, and a minimal `notifications` baseline with the `Notification` model. Keep notification preferences, realtime receipts, and devices for Phase 8.
- Implement job CRUD, internal/external/hybrid apply mode, saved jobs, job skills, job status.
- Implement internal applications with resume attachments, screening answers, cover letter, status history, review notes.
- Implement external apply click tracking.
- Add applicant review for company recruiters/admins.
- Implement saved candidates, talent pools, company-private candidate notes, and outreach permission checks.
- Persist basic notifications for application and recruiting events.
- Emit application events for notifications, email, audit, search, and messaging context.

Verification:

- E2E company admin creates internal job, candidate applies, admin reviews, status update notifies candidate.
- E2E external job exposes external apply flow and click tracking.
- E2E hybrid job supports both internal application and external URL.
- E2E non-company user cannot view applicants.
- E2E recruiter can save candidate only when entitlement and candidate visibility allow it.
- E2E one active application per user/job is enforced.

### Phase 5: Connections, Follows, and Blocks

Effort: **L**.

- Add `connections`.
- Implement connection request, accept, decline, remove.
- Implement user follows and blocks.
- Expose graph policy helpers for feed and messaging.

Verification:

- E2E connection lifecycle.
- E2E block prevents connection, feed visibility, and messaging.
- E2E follow affects feed candidate set.

### Phase 6: Posts and Full Feed

Effort: **XL**.

- Add `posts` and `feed`.
- Implement user/company posts, comments, reactions, mentions, hashtags, media attachments, saved posts, hidden posts.
- Implement home feed, profile feed, company feed, hashtag feed.
- Enforce public/network/follower/company visibility.
- Emit notifications for mentions, comments, reactions.
- Index posts in Postgres and Elasticsearch.

Verification:

- E2E user A connects with B, B posts network-visible post, A sees it, unrelated user does not.
- E2E public post appears to non-connected users.
- E2E company follower sees company post.
- E2E block hides feed items.
- E2E mentions and reactions create notifications.

### Phase 7: Messaging

Effort: **XL**.

- Add `messaging`.
- Implement direct conversations, recruiting conversations, company-candidate conversations.
- Implement messages, attachments, read state, participant authorization, presence hints, unread counters.
- Integrate application/recruiting context.
- Keep REST first; realtime delivery is implemented in Phase 8 without changing persistence.

Verification:

- E2E connected users can message.
- E2E recruiter/company admin can message candidate with valid recruiting context.
- E2E recruiter/company admin cannot message unauthorized candidate.
- E2E blocked users cannot message.
- E2E participant-only conversation reads.

### Phase 8: Realtime, Notification Preferences, and Email Delivery

Effort: **XL**.

- Expand `notifications` and `email`.
- Add `realtime` WebSocket gateway for live messages, notifications, typing indicators, read receipts, and presence.
- Implement notification preferences, notification list, read/read-all, unread counters, and realtime dispatch.
- Implement email delivery retry handling, templates, and provider failure handling.
- Send email for password reset, application status changes, important message notification rules, and digest-ready events.

Verification:

- E2E notification creation/read/read-all.
- E2E WebSocket authenticated subscribe, message delivery, notification delivery, and unauthorized channel rejection.
- Unit tests for notification preference filtering.
- Unit tests for email delivery records and provider adapter failure handling.

### Phase 9: Advanced Search and Reindexing

Effort: **XL**.

- Complete `search` as a cross-domain facade.
- Implement combined search and domain-specific search for users, companies, jobs, and posts.
- Implement Postgres full-text fallback.
- Implement Elasticsearch query tuning, filters, aliases, document versioning, and query logging.
- Add admin-only reindex with safe alias swap.

Verification:

- E2E search works with Elasticsearch enabled.
- E2E search falls back to Postgres when Elasticsearch is unavailable.
- E2E admin reindex is protected.

### Phase 10: Recommendations

Effort: **L**.

- Add `recommendations`.
- Implement simple recommendations:
  - people you may know,
  - jobs you may like,
  - companies to follow.
- Use existing connections, profiles, skills, jobs, applications, follows, search signals, and analytics aggregates.

Verification:

- Unit tests for recommendation query rules.
- E2E recommendation endpoints exclude blocked users and private content.

### Phase 11: Moderation, Admin, Analytics, and Production Hardening

Effort: **XL**.

- Add `moderation`, `admin`, and `analytics`.
- Implement reports, moderation actions, content status, admin user/company/job controls.
- Implement profile views, company views, job views, post impressions, search logs, external apply metrics, and application funnel aggregates.
- Add request IDs, structured logging, consistent error envelope, health/readiness checks.
- Harden rate limits for auth, messaging, job application, comments, posts, and notification-heavy endpoints.
- Add API documentation after route contracts stabilize.

Verification:

- Full regression: build, lint, unit, e2e, Prisma validate/generate.
- E2E report → admin review → moderation action.
- E2E admin-only access controls.
- E2E company analytics respects role and privacy-safe aggregation rules.
- Docker Compose full smoke test.

### Phase 12: Billing and Advanced Entitlements

Effort: **XL**.

- Add `billing`.
- Implement billing plans, company subscriptions, invoices, job posting credits, recruiter seat entitlements, entitlement grants, and payment-provider event records.
- Keep payment provider optional until a provider is chosen; product code must consume entitlement checks only.
- Add provider webhook adapter when payment collection is enabled.

Verification:

- E2E company owner can view billing and entitlements.
- E2E non-billing member cannot manage billing.
- E2E job posting and recruiter outreach respect credits/seats.
- Unit tests for webhook idempotency and entitlement recalculation.

## Verification Strategy

- Unit tests for service business rules, policy checks, token/media/search helpers, outbox processors, entitlement checks, and event handlers.
- E2E tests for every critical user journey and every expected `403`.
- Use a test database strategy from Phase 0: reset schema, run migrations, seed minimal fixtures.
- Use local Docker services for integration tests that require Postgres, Redis, MinIO, and Elasticsearch.
- Validate Prisma schema on every phase.
- Generate Prisma client after every schema change.
- Run build/lint/test/e2e at phase boundaries.
- Verify outbox idempotency and retry behavior at every phase that adds a new processor.
- Verify Elasticsearch fallback by running at least one search e2e path with Elasticsearch unavailable.
- CI must pass before merge: install, Prisma validate/generate, lint, typecheck, unit, build, e2e.
- Deploy verification must include migration success, image rollout success, health endpoints, and one smoke journey per active runtime role.
- Observability verification must include one emitted trace, one structured request log, one outbox processor metric, and one readiness failure test.

Phase boundary commands:

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm run build
npm run lint
npm test
npm run test:e2e
```

## Expanded Test Plan

### Unit Testing Strategy

**Scope**: Service business rules, policy checks, token/media/search helpers, outbox processors, entitlement checks, event handlers.

**Coverage targets**:
- Authorization policies: 100% (every policy decision has positive and negative test)
- Outbox processors: 100% (idempotency, retry, dead-letter paths)
- Token/hashing utilities: 100% (security-critical code)
- Business rules: 80%+ (focus on edge cases and error paths)

**Key test patterns**:
- Policy tests: `should allow owner`, `should deny non-owner`, `should deny when blocked`
- Processor tests: `should process event`, `should be idempotent`, `should retry on failure`, `should dead-letter after max retries`
- Token tests: `should hash securely`, `should validate expiration`, `should reject tampered tokens`

**Test data strategy**: Use factory functions for test fixtures, avoid shared mutable state, reset database between tests.

### Integration Testing Strategy

**Scope**: Multi-service interactions, database transactions, outbox event flow, external adapter behavior.

**Coverage targets**:
- Critical user journeys: 100% (auth, apply to job, recruiter message candidate)
- Cross-domain flows: 100% (application → recruiting context → messaging permission)
- Outbox event chains: 100% (domain write → outbox event → processor → side effect)

**Key test patterns**:
- Transaction tests: `should rollback domain write when outbox fails`
- Event flow tests: `should create notification when application status changes`
- Adapter tests: `should fall back to Postgres when Elasticsearch unavailable`

**Test environment**: Docker Compose with Postgres, Redis, MinIO (Phase 5+), Elasticsearch (Phase 9+).

### End-to-End Testing Strategy

**Scope**: Full HTTP request/response cycles, authentication flow, authorization enforcement, API contracts.

**Coverage targets**:
- Every protected endpoint: 100% (both authorized success and `403` denial)
- Critical user journeys: 100% (register → verify → login → apply → message)
- Error handling: 80%+ (validation errors, not-found, conflict, rate-limit)

**Key test patterns**:
- Auth tests: `POST /auth/register → POST /auth/verify-email → POST /auth/login → GET /users/me`
- Authorization tests: `should return 403 when non-owner tries to update profile`
- Journey tests: `candidate applies → recruiter reviews → recruiter messages candidate`

**Test data strategy**: Seed minimal fixtures per test, use unique emails/usernames to avoid conflicts, clean up after each test.

### Observability Testing Strategy

**Scope**: Structured logs, request correlation, health checks, metrics emission, trace propagation.

**Coverage targets**:
- Health endpoints: 100% (live, ready, startup for each dependency)
- Log redaction: 100% (passwords, tokens, secrets never logged)
- Request correlation: 100% (every request log includes request ID)
- Metrics emission: smoke tests for critical metrics (outbox pending, HTTP latency)

**Key test patterns**:
- Health tests: `should report ready when all dependencies healthy`, `should report not ready when Postgres down`
- Redaction tests: `should not log authorization header`, `should not log password in request body`
- Correlation tests: `should include request ID in all logs for a request`
- Metrics tests: `should increment outbox pending count when event created`

**Test environment**: Capture logs/metrics in test mode, assert on structured log fields, verify trace context propagation.

### Phase-Specific Test Requirements

**Phase 0A**: Health checks (Postgres, Redis), config validation, API envelope format, TypeScript compilation.

**Phase 0B**: Storage adapter smoke (MinIO), search adapter smoke (Elasticsearch), mail adapter smoke (SMTP), structured logging with redaction.

**Phase 0C**: Outbox processor (lease, process, retry, dead-letter, idempotency), runtime role separation (api/worker/all).

**Phase 1**: Auth flow (register, verify, login, refresh, logout, password reset), rate limits, audit logs, `403` for unverified users on high-trust actions.

**Phase 2**: Profile CRUD, media upload (intent, presigned URL, complete), search (Postgres fallback + Elasticsearch), authorization (owner/admin/public).

**Phase 3**: Company CRUD, member roles, follower flow, entitlement checks, `403` for non-admin company changes.

**Phase 4**: Job CRUD (internal/external/hybrid), application flow, recruiter saved candidates, talent pools, outreach permission checks, `403` for unauthorized applicant access.

**Phase 5**: Connection lifecycle, follow/block, graph policy checks, `403` when blocked.

**Phase 6**: Post CRUD, comments, reactions, feed visibility (public/network/follower/company), mention notifications, `403` when blocked.

**Phase 7**: Messaging (direct, recruiting, company-candidate), participant authorization, attachment flow, `403` for unauthorized conversations.

**Phase 8**: Realtime WebSocket (auth, subscribe, message delivery, notification delivery), notification preferences, email delivery retry.

**Phase 9**: Search (combined, domain-specific, Postgres fallback, Elasticsearch tuning), admin reindex, query logging.

**Phase 10**: Recommendations (people, jobs, companies), privacy filters (no blocked users, no private content).

**Phase 11**: Moderation (reports, actions, content status), admin APIs, analytics (views, impressions, funnel), rate limits for write-heavy endpoints.

**Phase 12**: Billing (plans, subscriptions, invoices, credits, entitlements), payment webhook idempotency, entitlement enforcement.

## Risks & Mitigations

- Scope risk: “full LinkedIn-like” is an **XL product**, not one implementation pass. Mitigation: plan the full product now, execute one phase at a time.
- Boundary risk: modules can become tangled. Mitigation: enforce owner-service writes and policy-service checks.
- Authorization risk: company/recruiter/candidate messaging and applicant review are easy to over-permit. Mitigation: explicit authorization matrix and e2e `403` tests.
- Outbox risk: processors can duplicate side effects or stall. Mitigation: idempotency keys, leases, bounded retries, dead-letter state, and admin replay tooling.
- Elasticsearch consistency risk: Elasticsearch can become stale. Mitigation: Postgres fallback, outbox index events, index versioning, and admin reindex with alias swap.
- Media security risk: S3 URLs can leak or bypass authorization. Mitigation: presigned URLs, asset ownership, private buckets by default.
- Feed performance risk: full feed can become slow. Mitigation: cursor pagination, indexes, Redis hints, and later ranking/queue extraction.
- Realtime risk: WebSocket delivery can diverge from persisted state. Mitigation: REST remains source of truth; realtime is best-effort delivery of persisted events.
- Billing risk: payment rules can pollute product domains. Mitigation: domains check entitlements only; payment provider state stays inside `billing`.
- CI/CD risk: deployment workflows can leak secrets or deploy unverified artifacts. Mitigation: protected environments, OIDC, least-privilege workflow permissions, CI gates, and image promotion.
- Observability risk: missing traces/logs makes distributed extraction unsafe. Mitigation: OpenTelemetry, structured logs, health probes, outbox metrics, and service-level dashboards from Phase 0.
- Migration risk: schema changes can break rolling deploys. Mitigation: `prisma migrate deploy`, source-controlled migrations, expand/contract changes, and migration runbooks.
- Privacy risk: profiles, messages, applications, and resumes contain sensitive data. Mitigation: strict ownership checks, no credential/body logging, audit logs, and private media by default.

## Privacy & Security

- Never commit `.env`; only commit `.env.example` with placeholders.
- Passwords, refresh tokens, and password reset tokens must be hashed.
- JWT secret, token TTLs, CORS origins, database URL, Redis URL, S3 credentials, Elasticsearch URL/credentials, mail credentials, and payment provider secrets must come from validated environment variables.
- Do not log access tokens, refresh tokens, reset tokens, passwords, resumes, full message bodies, or full request bodies containing credentials.
- Use service-level authorization checks for profile editing, media access, company administration, job ownership, application review, recruiting access, conversation membership, notification ownership, analytics, billing, moderation, and admin APIs.
- Private S3 objects should use short-lived signed URLs.
- Elasticsearch documents must not contain full private message bodies, raw resumes, secrets, or private candidate notes.
- GitHub Actions secrets must be environment-scoped. Deployment should prefer OIDC federation over long-lived cloud access keys.
- Logs/traces/metrics must use redaction and sampling rules that protect sensitive data while preserving debugging value.

## Open Questions

- `[DECIDE BEFORE PHASE 0B]` Pin Elasticsearch Docker image/client major version and local-only security settings. Do not use floating `latest` tags.
- `[DECIDE DURING PHASE 0]` Choose deployment target: single VM, Docker Compose server, ECS, Kubernetes later, Render/Fly/Railway, or another platform. Architecture should not assume Kubernetes in Phase 0.
- `[DECIDE DURING PHASE 0]` Choose observability backend: local OpenTelemetry collector only, Grafana stack, managed vendor, or cloud-native monitoring.
- `[DECIDE DURING PHASE 0]` Choose container registry: GHCR by default unless deployment platform requires another registry.
- `[DECIDE DURING PHASE 0]` Choose CI deploy auth target for OIDC: AWS/GCP/Azure/other, or manual deploy until a cloud target is selected.
- `[DECIDE DURING PHASE 2]` Resume visibility default: recommended default is explicit user-approved viewers plus companies the user applied to.
- `[DECIDE DURING PHASE 8]` WebSocket deployment mode: same Nest process for local/dev; separate API/worker/realtime processes only when production scaling requires it.
- `[DECIDE DURING PHASE 12]` Billing provider: Stripe, Paddle, Lemon Squeezy, manual invoicing, or no payment collection.
- `[DEFERRED UNTIL SCALE SIGNAL]` BullMQ/Kafka/RabbitMQ extraction from transactional outbox.
- `[DEFERRED UNTIL PRODUCT SIGNAL]` Advanced ML ranking for recommendations and feed.

## Next Command

After approval, execute **Phase 0A: Repo Baseline and Core Infra** only. Do not start Phase 0B or product domain code until Phase 0A passes verification.

## Definition of Done

This plan is considered **DONE** when all of the following criteria are met:

### Functional Completeness
- ✅ All 12 phases implemented and verified
- ✅ All API endpoints from the API Surface Roadmap are functional
- ✅ All event flows from the Event Flows section are operational
- ✅ All authorization rules from the Authorization Matrix are enforced

### Vertical Slice Validation (Phases 0-4)
- ✅ User can register, verify email, login, create profile
- ✅ Verified user can create company, add company members
- ✅ Company admin can post job (internal/external/hybrid)
- ✅ Candidate can apply to job internally
- ✅ Company recruiter can review application, update status
- ✅ Candidate receives notification of status change
- ✅ Company recruiter can message candidate (recruiting context validated)
- ✅ All above flows work end-to-end in staging environment

### Technical Quality
- ✅ All phase acceptance criteria met
- ✅ CI pipeline passes: install, Prisma validate/generate, lint, typecheck, unit tests, build, e2e tests
- ✅ Test coverage: authorization policies 100%, outbox processors 100%, business rules 80%+
- ✅ All protected endpoints have `403` authorization tests
- ✅ No secrets, tokens, passwords, or PII in logs
- ✅ All environment variables validated at startup
- ✅ Health checks operational: `/health/live`, `/health/ready`
- ✅ Structured logging with request correlation IDs
- ✅ OpenTelemetry traces and metrics emitted (Phase 11+)

### Operational Readiness
- ✅ Docker Compose runs full local stack (Postgres, Redis, MinIO, Elasticsearch)
- ✅ Production Docker image builds and runs in all roles (api, worker, realtime, all)
- ✅ CI/CD pipeline functional: PR validation, security scanning, deployment to staging
- ✅ Database migrations run successfully via `prisma migrate deploy`
- ✅ Outbox processors handle events reliably (lease, process, retry, dead-letter)
- ✅ Rate limits prevent abuse on auth, messaging, application, and write-heavy endpoints
- ✅ Runbooks exist for: deployment, rollback, migration failure, outbox backlog, incidents

### Architecture Quality
- ✅ Module boundaries enforced: no cross-module private imports
- ✅ Modules communicate via exported interfaces and outbox events
- ✅ No module depends on another module's private Prisma write model
- ✅ Storage, search, and observability behind adapters (extraction-ready)
- ✅ Authorization decisions centralized in policy services
- ✅ Transactional outbox used for all cross-domain side effects
- ✅ `docs/architecture.md` documents extraction readiness with concrete steps

### Security & Privacy
- ✅ All passwords, tokens, and secrets hashed before storage
- ✅ JWT secret, database credentials, S3 credentials, and provider secrets in environment variables (not code)
- ✅ Private S3 buckets with presigned URLs for controlled access
- ✅ Elasticsearch documents exclude secrets, tokens, resumes, private notes, full message bodies
- ✅ Logs redact authorization headers, cookies, passwords, tokens
- ✅ GitHub Actions use protected environments and least-privilege permissions
- ✅ Audit logs capture security-sensitive events (auth, role changes, admin actions)

### Documentation
- ✅ `.env.example` documents all required environment variables
- ✅ `README.md` includes setup instructions, development workflow, testing commands
- ✅ `docs/architecture.md` documents ADRs, module boundaries, extraction strategy
- ✅ `docs/runbooks/` includes operational procedures
- ✅ API documentation generated (OpenAPI/Swagger) after Phase 11

### Deployment Success
- ✅ Application deployed to staging environment
- ✅ Staging smoke tests pass: health checks, auth flow, job application flow
- ✅ Database migrations applied successfully
- ✅ No secrets committed to repository
- ✅ Monitoring/observability operational (logs, traces, metrics, health checks)

### User Value Delivered
- ✅ Complete user-to-recruiter vertical slice functional in staging
- ✅ Users can discover jobs, apply, and receive status updates
- ✅ Recruiters can post jobs, review applications, and message candidates
- ✅ System handles concurrent users without data corruption
- ✅ Foundation ready for incremental feature additions (connections, posts, feed, realtime)

**Success Metric**: A candidate can register, verify email, create profile, apply to a job, and receive a message from the recruiter—all in staging, with audit logs, structured logging, and reliable event processing operational.
