<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 | Updated: 2026-05-27 -->

# src

## Purpose

Application source code for the mdc-be NestJS modular monolith. Contains 19 domain modules (admin, analytics, applications, auth, billing, companies, connections, email, feed, jobs, media, messaging, moderation, notifications, outbox, posts, profiles, realtime, recommendations, recruiting, search, users) plus shared infrastructure (common, infra, types). Each domain module is self-contained with controllers, services, DTOs, and tests. Cross-domain communication uses the transactional outbox pattern. The application bootstraps with OpenTelemetry instrumentation, configures security middleware (helmet, CORS, throttling), and supports runtime role separation (api/worker/realtime/all).

## Key Files

| File | Description |
|------|-------------|
| `main.ts` | Application entry point: creates NestJS app, configures logger, applies middleware, wires Redis-backed Socket.io adapter for realtime role, listens on configured port |
| `app.module.ts` | Root module: imports all 19 domain modules, configures ThrottlerModule with Redis storage (300 req/60s), ScheduleModule with role-based cron/interval enablement |
| `bootstrap.ts` | Middleware configuration: helmet CSP, body parsers (json/urlencoded), validation pipe, exception filter, response interceptor, CORS, request ID middleware, global prefix `/api/v1` |
| `instrumentation.ts` | OpenTelemetry SDK setup: auto-instrumentations for HTTP/Redis/Prisma, OTLP exporters for traces/metrics, console exporter in dev, singleton guard via global flag |
| `instrumentation.config.ts` | OTLP endpoint resolver for trace/metric exporters |
| `app.controller.ts` | Root health check endpoints: `/` (200 OK), `/health/live`, `/health/ready` |
| `app.service.ts` | Root service (minimal, used by app.controller) |

## Subdirectories

| Directory | Purpose | Reference |
|-----------|---------|-----------|
| `admin/` | Admin panel APIs: user management, content moderation, system metrics | `admin/AGENTS.md` |
| `analytics/` | Analytics tracking: event ingestion, metrics aggregation, reporting | `analytics/AGENTS.md` |
| `applications/` | Job application lifecycle: submit, review, status updates, notifications | `applications/AGENTS.md` |
| `auth/` | Authentication and authorization: JWT tokens, session management, guards | `auth/AGENTS.md` |
| `billing/` | Subscription and payment processing: Stripe integration, invoices, webhooks | `billing/AGENTS.md` |
| `companies/` | Company profiles: creation, updates, verification, search | `companies/AGENTS.md` |
| `connections/` | Professional network graph: connection requests, acceptance, removal | `connections/AGENTS.md` |
| `email/` | Transactional email: templates, sending via SMTP, delivery tracking | `email/AGENTS.md` |
| `feed/` | Activity feed: post aggregation, ranking, personalization | `feed/AGENTS.md` |
| `jobs/` | Job postings: creation, search, filtering, recommendations | `jobs/AGENTS.md` |
| `media/` | File uploads: S3 presigned URLs, image processing, CDN integration | `media/AGENTS.md` |
| `messaging/` | Direct messaging: conversations, message delivery, read receipts | `messaging/AGENTS.md` |
| `moderation/` | Content moderation: flagging, review queue, automated filters | `moderation/AGENTS.md` |
| `notifications/` | Push notifications: in-app, email, WebSocket delivery | `notifications/AGENTS.md` |
| `outbox/` | Transactional outbox pattern: event emission, processing, retry logic | `outbox/AGENTS.md` |
| `posts/` | User-generated content: posts, comments, reactions, sharing | `posts/AGENTS.md` |
| `profiles/` | User profiles: bio, skills, experience, education, visibility settings | `profiles/AGENTS.md` |
| `realtime/` | WebSocket gateway: Socket.io with Redis adapter, room management | `realtime/AGENTS.md` |
| `recommendations/` | Recommendation engine: job matches, connection suggestions, content ranking | `recommendations/AGENTS.md` |
| `recruiting/` | Recruiter tools: candidate search, outreach, pipeline management | `recruiting/AGENTS.md` |
| `search/` | Full-text search: Elasticsearch integration, indexing, query DSL | `search/AGENTS.md` |
| `users/` | User account management: registration, profile updates, deactivation | `users/AGENTS.md` |
| `common/` | Shared utilities: decorators, guards, filters, interceptors, validation, pagination, error handling | `common/AGENTS.md` |
| `infra/` | Infrastructure services: config, logger (Pino), Prisma, Redis, S3, Elasticsearch, health checks, scheduling | `infra/AGENTS.md` |
| `types/` | TypeScript type augmentations: Express request extensions | `types/AGENTS.md` |

## For AI Agents

### Working In This Directory

**Module Structure:**
- Each domain module follows NestJS conventions: `{module}.module.ts`, `{module}.controller.ts`, `{module}.service.ts`
- DTOs live in `dto/` subdirectories with `create-*.dto.ts`, `update-*.dto.ts`, `query-*.dto.ts` naming
- Tests colocate with source: `*.spec.ts` files alongside implementation
- Barrel exports via `index.ts` are optional (most modules use explicit imports)

**Cross-Domain Communication:**
- Direct imports between domain modules are forbidden (enforced by ESLint)
- Use `OutboxService.emit(tx, event)` to publish events inside transactions
- Subscribe to events via `@OnEvent(EventType)` decorators in consumer modules
- Check `eslint.config.mjs` DOMAIN_IMPORT_ALLOWLIST before adding cross-domain imports

**Adding New Modules:**
1. Create directory under `src/{module}/`
2. Add `{module}.module.ts` with `@Module()` decorator
3. Import module in `app.module.ts`
4. Add module name to DOMAIN_IMPORT_ALLOWLIST in `eslint.config.mjs`
5. Create `{module}/AGENTS.md` documenting purpose and patterns
6. Run `npm run lint` to verify no boundary violations

**Common Patterns:**
- Use `@ApiExceptionFilter()` for consistent error responses
- Use `@ApiResponseInterceptor()` for standardized success responses
- Use `createValidationPipe()` for DTO validation with class-validator
- Use `@CurrentUser()` decorator to extract authenticated user from request
- Use `PaginationDto` for paginated endpoints (page, limit, sort)
- Use `IdempotencyService` for idempotent operations (payments, emails)

**Infrastructure Services:**
- Config: Inject `ConfigService<AppConfig, true>` for type-safe environment variables
- Database: Inject `PrismaService` for database access
- Cache: Inject `REDIS_CLIENT` token for Redis operations
- Storage: Inject `StorageService` for S3 uploads/downloads
- Search: Inject `SearchEngineService` for Elasticsearch queries
- Logger: Inject `Logger` from `nestjs-pino` (auto-configured with request context)

**Security:**
- All routes under `/api/v1` prefix (except health checks)
- Helmet CSP enforced: `default-src 'none'`, `frame-ancestors 'none'`
- CORS configured via `CORS_ORIGINS` environment variable
- Rate limiting: 300 requests per 60 seconds via Redis-backed throttler
- Request ID tracking: `x-request-id` header auto-generated or forwarded

**OpenTelemetry:**
- Traces and metrics exported to OTLP endpoint (configurable via `OTEL_EXPORTER_OTLP_ENDPOINT`)
- Auto-instrumentation for HTTP, Redis, Prisma
- Health check requests (`/health/live`, `/health/ready`) excluded from traces
- Service name: `mdc-be`, version from `package.json`
- Console exporter in development, OTLP in production

### Testing Requirements

**Unit Tests:**
- Colocate `*.spec.ts` files with source code
- Mock external dependencies (Prisma, Redis, S3, Elasticsearch)
- Use `Test.createTestingModule()` for NestJS dependency injection
- Run `npm test` to execute all unit tests
- Run `npm run test:watch` for watch mode
- Run `npm run test:cov` for coverage report

**E2E Tests:**
- E2E tests live in `test/` directory (see `test/AGENTS.md`)
- Use Testcontainers for isolated PostgreSQL/Redis instances
- Enable via `MDC_E2E_TESTCONTAINERS=true` environment variable

**Coverage Thresholds:**
- Branches: 50%
- Functions: 57%
- Lines: 59%
- Statements: 60%
- Enforced by Jest configuration in `package.json`

### Common Patterns

**DTO Validation:**
```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

**Outbox Event Emission:**
```typescript
await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: dto });
  await this.outboxService.emit(tx, {
    type: 'user.created',
    payload: { userId: user.id },
  });
});
```

**Pagination:**
```typescript
import { PaginationDto } from '@/common/pagination';

@Get()
async findAll(@Query() query: PaginationDto) {
  return this.service.findAll(query);
}
```

**Current User Extraction:**
```typescript
import { CurrentUser } from '@/common/decorators';

@Get('me')
async getProfile(@CurrentUser() user: JwtPayload) {
  return this.service.findById(user.sub);
}
```

**Error Handling:**
```typescript
import { ApiException } from '@/common/errors';

if (!user) {
  throw new ApiException('USER_NOT_FOUND', 404);
}
```

## Dependencies

### Internal
- `common/`: Shared decorators, guards, filters, interceptors, validation, pagination
- `infra/`: Config, logger, Prisma, Redis, S3, Elasticsearch, health checks
- `types/`: TypeScript type augmentations for Express
- `outbox/`: Transactional outbox pattern for cross-domain events

### External
- `@nestjs/common`, `@nestjs/core`: NestJS framework
- `@nestjs/config`: Type-safe configuration management
- `@nestjs/jwt`, `@nestjs/passport`: Authentication
- `@nestjs/platform-express`: Express adapter
- `@nestjs/platform-socket.io`, `@nestjs/websockets`: WebSocket support
- `@nestjs/schedule`: Cron jobs and intervals
- `@nestjs/throttler`: Rate limiting
- `@prisma/client`: Database ORM
- `ioredis`: Redis client
- `@aws-sdk/client-s3`: S3 storage
- `@elastic/elasticsearch`: Full-text search
- `helmet`: Security headers
- `class-validator`, `class-transformer`: DTO validation
- `nestjs-pino`: Structured logging
- `@opentelemetry/sdk-node`: Observability

<!-- MANUAL: -->
