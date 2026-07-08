<!-- Generated: 2026-05-27 | Updated: 2026-07-06 -->

# mdc-be

## Purpose

Professional networking and jobs platform backend built as a NestJS 11 modular monolith. The application features 24 domain modules with strict architectural boundaries enforced via ESLint, a transactional outbox pattern for cross-domain events, and runtime role separation (api/worker/realtime/all) for horizontal scaling. The platform supports user profiles, connections, job postings, applications, recruiting, messaging, real-time notifications, content moderation, analytics, billing, GDPR/CCPA compliance, observability, and A/B experiments.

## Key Files

| File                  | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `package.json`        | Project dependencies, npm scripts, and Jest configuration                    |
| `tsconfig.json`       | Strict TypeScript configuration with ES2023 target and nodenext modules      |
| `nest-cli.json`       | NestJS CLI configuration with sourceRoot pointing to src/                    |
| `.env.example`        | Environment variable template with role-specific database pool limits        |
| `eslint.config.mjs`   | Domain boundary enforcement via DOMAIN_MODULES + DOMAIN_IMPORT_ALLOWLIST (24 modules)         |
| `.prettierrc`         | Code formatting rules (single quotes, trailing commas)                       |
| `docker-compose.yml`  | Local infrastructure (PostgreSQL 16, Redis 7, MinIO, Elasticsearch 8.17)     |
| `Dockerfile`          | Multi-stage production build configuration                                   |
| `jest.setup.ts`       | Test environment defaults and global test configuration                      |
| `tsconfig.build.json` | Production build configuration excluding test files                          |
| `README.md`           | Quick start guide, development commands, and runtime roles                   |
| `PLAN_FULL.md`        | Complete feature plan with must-haves, artifacts, and architecture decisions |

## Subdirectories

| Directory   | Purpose                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `src/`      | Application source code with 24 domain modules, common utilities, and infrastructure (see `src/AGENTS.md`) |
| `prisma/`   | Database schema and migrations for PostgreSQL (see `prisma/AGENTS.md`)                                     |
| `test/`     | E2E test suite with Testcontainers support (see `test/AGENTS.md`)                                          |
| `docs/`     | Architecture documentation, ADRs, runbooks, and frontend specs (see `docs/AGENTS.md`)                      |
| `.github/`  | GitHub Actions CI/CD workflows (see `.github/AGENTS.md`)                                                   |
| `.beads/`   | Beads issue tracking database (git-tracked)                                                                |
| `coverage/` | Jest coverage reports (generated, not committed)                                                           |
| `dist/`     | Compiled TypeScript output (generated, not committed)                                                      |

## For AI Agents

### Working In This Directory

**Before Starting Work:**

- Read `README.md` for quick start and development setup
- Read `docs/architecture.md` for outbox pattern, process roles, and ADRs
- Check `eslint.config.mjs` DOMAIN_IMPORT_ALLOWLIST before adding cross-domain imports
- Review domain-specific `src/{module}/AGENTS.md` files for area-specific rules
- Use `bd ready` to find actionable issues (see Beads Workflow section below)

**Domain Boundaries:**

- 24 domain modules (enforced by `DOMAIN_MODULES` in `eslint.config.mjs`): admin, analytics, applications, auth, billing, companies, connections, email, feed, gdpr, jobs, media, messaging, moderation, notifications, observability, outbox, posts, profiles, realtime, recommendations, recruiting, search, users
- Note: `experiments` is a 25th module with `DOMAIN_IMPORT_ALLOWLIST` entries but is not yet in `DOMAIN_MODULES` (cross-domain imports into `experiments` are not currently restricted)
- Cross-domain imports require explicit allowlist entries in `eslint.config.mjs`
- Violations fail lint with actionable error message
- Test files are exempt from boundary checks

**Outbox Pattern:**

- Emit cross-domain events via `OutboxService.emit(tx, event)` inside transactions
- Events written to `outbox_events` table with `status=PENDING`
- Worker role processes events every 5s with `SELECT FOR UPDATE SKIP LOCKED`
- Retry with exponential backoff, dead-letter after 5 attempts
- Idempotency enforced via `IdempotencyService`

**Runtime Roles:**

- Set `APP_PROCESS_ROLE` environment variable to control which components load
- `api`: HTTP routes only (no background jobs, no WebSockets)
- `worker`: Background jobs, outbox processing, scheduled cleanup
- `realtime`: WebSocket gateways with Redis adapter
- `all`: Local development (everything enabled)

**Testing:**

- Unit tests: Colocate `*.spec.ts` files alongside source
- Use `jest.setup.ts` for test environment defaults
- E2E tests: Enable Testcontainers via `MDC_E2E_TESTCONTAINERS=true`
- Coverage thresholds: branches 50%, functions 57%, lines 59%, statements 60%

**Database:**

- Run `npx prisma validate` after schema changes
- Run `npx prisma generate` after model changes
- Migrations are committed to `prisma/migrations/`

**Code Quality:**

- Never use `any` type (enforced by ESLint as error)
- Never leave floating promises (enforced by ESLint as error)
- Lint runs with `--max-warnings 0` (zero tolerance)
- Match existing patterns in `src/common/` for decorators, filters, interceptors

**Verification Before Completion:**

- Run `npm run check` (typecheck + lint + test + fallow audit on changed files)
- Run `npm run check:strict` (same as check + full fallow audit, fails on any pre-existing issue)
- Run `npm run build` to verify production build
- Run `npx prisma validate` if schema was modified
- All checks must pass before claiming task complete

**Fallow Audit Gate:**

Fallow runs as part of `npm run check` via the `--changed-since origin/main` diff mode. This means:

- The local pre-merge gate catches **new** fallow issues introduced by your branch
- Pre-existing issues (saved in `.fallow/baseline.json`) do **not** block your merge
- To address pre-existing issues, use `npm run fallow:audit` (full repo) or `npm run fallow:audit:human` (readable)
- To install the optional pre-commit hook (no new deps): `git config core.hooksPath .githooks`
- To skip fallow in a one-off commit: `MDC_SKIP_FALLOW=1 git commit ...`

Available scripts: `npm run fallow:audit`, `fallow:audit:diff`, `fallow:audit:changed`, `fallow:dead`, `fallow:health`, `fallow:dupes`, `fallow:fix`, `fallow:trace`, `fallow:baseline:save`, `fallow:baseline:check`. See `.opencode/context/fallow.md` for the full reference.

### Testing Requirements

**Unit Tests:**

```bash
npm test              # Run all unit tests
npm run test:watch    # Watch mode
npm run test:cov      # Generate coverage report
```

**E2E Tests:**

```bash
npm run test:e2e      # Run e2e tests with Testcontainers
```

**Pre-Merge Checks:**

```bash
npm run check         # Runs: typecheck + lint + test + fallow audit (changed files)
npm run check:strict  # Same + full fallow audit (catches pre-existing issues)
npm run build         # Verify production build
npx prisma validate   # Validate schema integrity
```

**Coverage Targets:**

- Branches: 50%
- Functions: 57%
- Lines: 59%
- Statements: 60%

### Common Patterns

**NestJS Patterns:**

- Global response envelope via `ApiResponseInterceptor`
- Global error handling via `ApiExceptionFilter`
- Authentication: `@CurrentUser()` decorator extracts user from JWT
- Public routes: `@Public()` decorator bypasses auth guard
- Validation: `createValidationPipe()` with class-validator
- Pagination: `CursorPaginationQueryDto` for cursor-based pagination

**Dependency Injection:**

- Import classes directly (not `import type`) for injection tokens
- Use constructor injection for all dependencies
- Prefer interface-based tokens for testability

**Custom Decorators:**

- Param decorators: `createParamDecorator()` (example: `@CurrentUser()`)
- Metadata decorators: `SetMetadata()` (example: `@Public()`)
- See `src/common/AGENTS.md` for full decorator catalog

**Error Handling:**

- Throw NestJS HTTP exceptions (`BadRequestException`, `NotFoundException`, etc.)
- `ApiExceptionFilter` normalizes all errors to consistent format
- Include actionable error messages for client debugging

**Async Operations:**

- Always await promises (enforced by ESLint)
- Use `Promise.all()` for parallel operations
- Wrap database operations in transactions when needed

## Dependencies

### Internal

- `src/common/` - Shared utilities, decorators, filters, interceptors, pipes
- `src/infra/` - Infrastructure services (database, cache, storage, search)
- `src/outbox/` - Transactional outbox pattern implementation
- `src/types/` - Shared TypeScript type definitions and interfaces
- `prisma/` - Database schema and migrations

### External

**Core Framework:**

- `@nestjs/core` 11.x - NestJS framework
- `@nestjs/common` 11.x - Common utilities
- `@nestjs/config` 4.x - Configuration management
- `@nestjs/platform-express` 11.x - Express adapter
- `@nestjs/platform-socket.io` 11.x - WebSocket support
- `socket.io` ^4.8.3 - WebSocket transport layer
- `@nestjs/schedule` ^6.1.3 - Cron jobs and intervals
- `@nestjs/throttler` ^6.5.0 - Rate limiting
- `@nestjs/websockets` ^11.1.22 - WebSocket server support
- `reflect-metadata` ^0.2.2 - TypeScript decorator reflection
- `rxjs` ^7.8.1 - Reactive extensions for async composition

**Database & ORM:**

- `@prisma/client` 6.19.3 - Prisma ORM
- `@prisma/instrumentation` 6.19.3 - OpenTelemetry integration

**Caching & Queuing:**

- `ioredis` 5.x - Redis client
- `@socket.io/redis-adapter` 8.x - Socket.IO Redis adapter
- `@nest-lab/throttler-storage-redis` 1.x - Rate limiting storage

**Storage:**

- `@aws-sdk/client-s3` 3.x - S3 client
- `@aws-sdk/s3-request-presigner` 3.x - Presigned URL generation

**Search:**

- `@elastic/elasticsearch` ~8.17 - Elasticsearch client

**Authentication:**

- `@nestjs/jwt` 11.x - JWT utilities
- `@nestjs/passport` 11.x - Passport integration
- `passport` 0.7.x - Authentication middleware
- `passport-jwt` 4.x - JWT strategy
- `bcryptjs` 3.x - Password hashing

**Validation:**

- `class-validator` 0.15.x - Decorator-based validation
- `class-transformer` 0.5.x - Object transformation
- `zod` 4.x - Schema validation

**Email:**

- `nodemailer` 8.x - Email sending
- `handlebars` 4.x - Email templates

**Logging:**

- `nestjs-pino` 4.x - Pino integration
- `pino` 10.x - Fast JSON logger
- `pino-http` 11.x - HTTP request logging

**Observability:**

- `@opentelemetry/api` 1.x - OpenTelemetry API
- `@opentelemetry/auto-instrumentations-node` 0.x - Auto-instrumentation
- `@opentelemetry/exporter-metrics-otlp-http` 0.x - Metrics exporter
- `@opentelemetry/exporter-trace-otlp-http` 0.x - Trace exporter
- `@opentelemetry/sdk-node` 0.x - Node SDK
- `prom-client` 15.x - Prometheus metrics registry, counters, histograms (observability module)

**Security:**

- `helmet` 8.x - Security headers
- `cookie-parser` 1.x - Cookie parsing

**Payments:**

- `stripe` 17.x - Stripe payment processing and webhooks (billing module)

**Push Notifications:**

- `firebase-admin` 14.x - Firebase Cloud Messaging (FCM) for Android/iOS push (infra/push)
- `apns2` 12.x - Apple Push Notification service (APNs) for iOS push (infra/push)

**Feature Flags:**

- `unleash-client` 6.x - Unleash server-side feature flag evaluation (infra/feature-flags, experiments module)

**Media Processing & Virus Scanning:**

- `sharp` 0.35.x - Image resizing/transformation (media module)
- `@pompelmi/nestjs` 1.x / `pompelmi` 1.20.x - ClamAV virus scanning for uploaded media (media virus-scan service)

**Compliance:**

- `archiver` 7.x - GDPR data export ZIP archive generation (gdpr module)

**Development:**

- `typescript` 5.7.3 - TypeScript compiler
- `@typescript-eslint/eslint-plugin` 8.20.0 - TypeScript linting
- `eslint` 9.18.0 - Linting
- `prettier` 3.x - Code formatting
- `jest` 30.x - Testing framework
- `@nestjs/testing` 11.x - NestJS test utilities
- `supertest` 7.x - HTTP assertions
- `testcontainers` 12.x - Integration test containers
- `typescript-eslint` 8.20.0 - TypeScript ESLint configuration
- `ts-loader` 9.x - TypeScript loader for webpack
- `pino-pretty` 13.x - Pino log formatting for development

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session
