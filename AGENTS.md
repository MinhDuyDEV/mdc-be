<!-- Generated: 2026-05-23T00:00:00.000Z | Updated: 2026-05-23T00:00:00.000Z -->

# mdc-be

## Purpose

A NestJS 11 backend for a professional networking and job platform (LinkedIn-like). This modular monolith provides authentication, user profiles, company pages, job postings, applications, recruiting tools, social features (posts, comments, reactions, connections), messaging, notifications, real-time updates, search, analytics, billing, and moderation. Built for horizontal scalability with explicit domain boundaries, transactional outbox pattern, and support for runtime role separation (API/worker/realtime).

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Project metadata, dependencies (NestJS 11, Prisma 6, Redis, S3, Elasticsearch), and npm scripts for build/test/dev |
| `tsconfig.json` | TypeScript configuration with strict mode, decorators, ES2023 target, and nodenext module resolution |
| `tsconfig.build.json` | Build-specific TypeScript config extending base tsconfig |
| `nest-cli.json` | NestJS CLI configuration with source root and compiler options |
| `.env.example` | Environment variable template for database, Redis, S3/MinIO, Elasticsearch, SMTP, JWT, rate limits, and billing |
| `Dockerfile` | Multi-stage production container image with builder and runtime stages |
| `docker-compose.yml` | Local development stack: Postgres 16, Redis 7, MinIO (S3), Elasticsearch 8.17 |
| `eslint.config.mjs` | ESLint 9 flat config with TypeScript, Prettier integration |
| `.prettierrc` | Code formatting rules |
| `.gitignore` | Git exclusions for node_modules, dist, .env, coverage, logs |
| `.dockerignore` | Docker build exclusions |
| `PLAN_FULL.md` | Complete feature plan with must-haves, artifacts, key links, and architecture decisions |
| `README.md` | Standard NestJS starter README with setup and deployment instructions |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Application source code with domain modules, infrastructure, and common utilities (see `src/AGENTS.md`) |
| `prisma/` | Database schema, migrations, and Prisma client configuration (see `prisma/AGENTS.md`) |
| `test/` | End-to-end test suite with Jest configuration and test helpers (see `test/AGENTS.md`) |
| `docs/` | Architecture documentation, decision records, and deployment guides |
| `.github/` | CI/CD workflows for testing, security scanning, and deployment |
| `.claude/` | Claude Code project configuration and instructions |
| `.omc/` | Oh-my-claudecode state, plans, and session artifacts |
| `.beads/` | Beads issue tracking database (git-tracked) |
| `dist/` | Compiled JavaScript output (generated, not tracked) |
| `node_modules/` | NPM dependencies (generated, not tracked) |

## For AI Agents

### Working In This Directory

- Run `npm run typecheck` and `npm run lint` before claiming completion
- Use `npm run prisma:validate` after any schema changes
- Test changes with `npm test` (unit) and `npm run test:e2e` (integration)
- Follow the transactional outbox pattern for cross-domain side effects
- Never commit `.env` files or secrets
- Use `bd` commands for issue tracking (see Beads Workflow section below)

### Testing Requirements

```bash
# Type checking
npm run typecheck

# Linting (auto-fixes issues)
npm run lint

# Unit tests
npm test

# E2E tests (requires docker-compose services)
npm run test:e2e

# Test coverage
npm run test:cov

# Prisma schema validation
npm run prisma:validate
```

### Common Patterns

- **API responses**: Success `{ data, meta? }`, Error `{ error: { code, message, details?, requestId? } }`
- **DI tokens**: `REDIS_CLIENT`, `STORAGE_CLIENT`, `SEARCH_ENGINE_CLIENT`, `MAILER_TRANSPORTER`
- **Runtime roles**: `APP_PROCESS_ROLE=api|worker|realtime|all` controls which features run
- **Outbox pattern**: Domain events flow through `src/outbox/` with leasing, retry, and idempotency
- **Module structure**: Each domain has `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.entity.ts`
- **Validation**: Use `class-validator` decorators with `ValidationPipe` (whitelist + transform)
- **Guards**: `@UseGuards(AuthGuard)` for authentication, custom guards for authorization
- **OpenTelemetry**: Instrumentation loaded via `--require ./src/instrumentation.ts` before app bootstrap

## Dependencies

### External

**Core Framework**
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` ^11.0.1 — NestJS framework
- `@nestjs/config` ^4.0.4 — Configuration management
- `@nestjs/jwt` ^11.0.2 — JWT authentication
- `@nestjs/passport` ^11.0.5 — Passport integration
- `@nestjs/schedule` ^6.1.3 — Cron jobs and intervals
- `@nestjs/throttler` ^6.5.0 — Rate limiting
- `@nestjs/websockets`, `@nestjs/platform-socket.io` ^11.1.22 — WebSocket support

**Database & Storage**
- `@prisma/client` ^6.19.3 — Prisma ORM client
- `@prisma/instrumentation` ^6.19.3 — Prisma OpenTelemetry
- `ioredis` ^5.10.1 — Redis client
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` ^3.1048.0 — S3 storage
- `@elastic/elasticsearch` ~8.17 — Elasticsearch client

**Real-time & Messaging**
- `socket.io` ^4.8.3 — WebSocket server
- `@socket.io/redis-adapter` ^8.3.0 — Redis-backed Socket.IO adapter
- `@nest-lab/throttler-storage-redis` ^1.2.0 — Redis throttler storage

**Authentication & Security**
- `passport` ^0.7.0, `passport-jwt` ^4.0.1 — JWT strategy
- `bcryptjs` ^3.0.3 — Password hashing
- `helmet` ^8.1.0 — Security headers
- `cookie-parser` ^1.4.7 — Cookie parsing

**Validation & Transformation**
- `class-validator` ^0.15.1 — DTO validation
- `class-transformer` ^0.5.1 — Object transformation
- `zod` ^4.4.3 — Schema validation

**Email & Templates**
- `nodemailer` ^8.0.7 — Email delivery
- `handlebars` ^4.7.9 — Email templates

**Observability**
- `nestjs-pino` ^4.6.1, `pino` ^10.3.1, `pino-http` ^11.0.0 — Structured logging
- `@opentelemetry/api` ^1.9.1 — OpenTelemetry API
- `@opentelemetry/sdk-node` ^0.218.0 — OpenTelemetry SDK
- `@opentelemetry/auto-instrumentations-node` ^0.76.0 — Auto-instrumentation
- `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/exporter-metrics-otlp-http` ^0.218.0 — OTLP exporters

**Utilities**
- `rxjs` ^7.8.1 — Reactive extensions
- `reflect-metadata` ^0.2.2 — Metadata reflection

**Development**
- `@nestjs/cli` ^11.0.0 — NestJS CLI
- `@nestjs/testing` ^11.0.1 — Testing utilities
- `jest` ^30.0.0, `ts-jest` ^29.2.5 — Test framework
- `supertest` ^7.0.0 — HTTP testing
- `testcontainers`, `@testcontainers/postgresql` ^12.0.0 — Integration test containers
- `prisma` ^6.19.3 — Prisma CLI
- `typescript` ^5.7.3, `typescript-eslint` ^8.20.0 — TypeScript tooling
- `eslint` ^9.18.0, `prettier` ^3.4.2 — Code quality
- `ts-node` ^10.9.2, `ts-loader` ^9.5.2 — TypeScript execution

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
