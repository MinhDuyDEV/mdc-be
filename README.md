# mdc-be

NestJS 11 backend for a professional networking and jobs platform. The app is a modular monolith with domain modules for authentication, profiles, companies, jobs, applications, recruiting, posts, connections, messaging, notifications, search, analytics, billing, moderation, and admin operations.

Core architecture choices:

- PostgreSQL through Prisma 6.
- Redis for rate limiting, Socket.IO fanout, and worker leader locks.
- S3-compatible media storage through AWS SDK or MinIO.
- Elasticsearch for search indexes.
- Transactional outbox for cross-domain side effects.
- Runtime role separation through `APP_PROCESS_ROLE=api|worker|realtime|all`.

## First 10 Minutes

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:validate
npm run start:dev
```

API defaults to `http://localhost:3000/api/v1`. Health checks are:

- `GET /health/live`
- `GET /health/ready`

## Development

```bash
npm run start:dev       # API with instrumentation preload
npm run typecheck       # TypeScript only
npm run lint            # strict ESLint, no auto-fix
npm run lint:fix        # local auto-fix
npm test                # unit tests with jest.setup.ts env defaults
npm run test:e2e        # e2e tests
npm run check           # typecheck + lint + unit tests
npm run build           # Nest production build
```

E2E tests can start infrastructure through Testcontainers when enabled:

```bash
MDC_E2E_TESTCONTAINERS=true npm run test:e2e
```

## Database

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run db:reset
```

Schema changes live in `prisma/schema.prisma` plus `prisma/migrations/`. Run `npm run prisma:validate` after any schema edit and `npm run prisma:generate` after model/client-shape changes.

## Runtime Roles

`APP_PROCESS_ROLE` controls what runs in each process:

- `api`: HTTP API only.
- `worker`: background jobs, outbox processing, scheduled cleanup.
- `realtime`: WebSocket gateways.
- `all`: local development role that runs everything.

Use role-specific `DATABASE_URL` pool limits in deployment, as documented in `.env.example`.

## Outbox

Domain services emit events inside Prisma transactions with `OutboxService.emit(tx, event)`. Worker processes claim pending rows, validate payloads through the event schema registry, dispatch handlers with bounded parallelism, and move exhausted failures to the dead-letter table.

Operational docs:

- [Architecture](docs/architecture.md)
- [Outbox replay runbook](docs/runbooks/outbox-replay.md)

## Project Guide

Read [AGENTS.md](AGENTS.md) before making changes. It documents domain boundaries, verification requirements, Beads workflow, and repository conventions. Subdirectories also include local `AGENTS.md` files for area-specific rules.

Before claiming work complete, run at least:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run prisma:validate
```

## Package

Private application package. License remains `UNLICENSED` unless project ownership chooses a release license.
