<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/infra

## Purpose

Infrastructure layer for the NestJS backend. Manages external service integrations (PostgreSQL via Prisma, Redis cache), environment configuration validation, and health check endpoints. Provides singleton services for database connections, cache clients, and configuration that are injected globally across the application.

## Key Files

| File | Description |
|------|-------------|
| `infra.module.ts` | Root infrastructure module; imports ConfigModule, exports PrismaService, Redis client, health services |
| `index.ts` | Barrel export; re-exports config, health, prisma, redis modules |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `config/` | Environment validation and configuration schema; parses and validates NODE_ENV, PORT, CORS_ORIGINS, database/redis URLs, health check timeouts (see `config/AGENTS.md`) |
| `health/` | Health check endpoints and service; implements `/health/live` (liveness) and `/health/ready` (readiness) probes for Kubernetes/orchestration (see `health/AGENTS.md`) |
| `prisma/` | Prisma ORM service wrapper; manages PostgreSQL connection lifecycle (connect on module init, disconnect on destroy) (see `prisma/AGENTS.md`) |
| `redis/` | Redis cache client provider and health service; manages ioredis connection, lazy connect, and Redis health checks (see `redis/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Module structure**: InfraModule is imported by AppModule; all infrastructure services are exported for global availability.
- **Configuration**: All config is validated at startup via `validateEnv()` in ConfigModule; invalid env vars cause app startup to fail.
- **Database**: PrismaService extends PrismaClient; use dependency injection to access it in any service.
- **Cache**: Redis client is provided via REDIS_CLIENT symbol; inject it with `@Inject(REDIS_CLIENT)`.
- **Health checks**: HealthController exposes `/health/live` (always 200) and `/health/ready` (200 if all dependencies up, 503 if any down).
- **Timeouts**: Health checks use configurable timeouts (HEALTH_DATABASE_TIMEOUT_MS, HEALTH_REDIS_TIMEOUT_MS) to prevent hanging.
- **Lifecycle**: Use NestJS lifecycle hooks (OnModuleInit, OnModuleDestroy, OnApplicationShutdown) to manage connection lifecycle.

### Testing Requirements

- **Unit tests**: Colocate `*.spec.ts` files alongside source files (e.g., `config/validate-env.spec.ts`).
- **Mocking**: Mock PrismaService and Redis client in tests; use jest.mock() or provide test doubles.
- **Config validation**: Test both valid and invalid environment variables in `validate-env.spec.ts`.
- **Health checks**: Test health service with mocked dependencies; verify timeout behavior.
- **Run tests**: `npm test` runs all unit tests; `npm run test:e2e` runs integration tests.

### Common Patterns

- **Dependency injection**: All services use constructor injection; never instantiate services directly.
- **Async lifecycle**: Use `OnModuleInit` to connect to external services, `OnModuleDestroy` to clean up.
- **Error handling**: Throw NestJS exceptions (BadRequestException, InternalServerErrorException, etc.); let global exception filter handle them.
- **Configuration**: Access config via `ConfigService<AppConfig, true>` (typed, strict mode); never use process.env directly.
- **Health checks**: Implement timeout wrappers to prevent health checks from hanging; use Promise.race() pattern.
- **Barrel exports**: Each subdirectory has `index.ts` that re-exports public API; import from `./config`, `./health`, etc., not from specific files.

## Dependencies

### Internal

- **config/**: Provides AppConfig interface and validateEnv() function.
- **health/**: Provides HealthService and HealthController.
- **prisma/**: Provides PrismaService.
- **redis/**: Provides RedisClient, redisProvider, RedisHealthService, REDIS_CLIENT symbol.

### External

- **@nestjs/common**: Injectable, Module, OnModuleInit, OnModuleDestroy, OnApplicationShutdown.
- **@nestjs/config**: ConfigModule, ConfigService for environment validation.
- **@prisma/client**: PrismaClient for database ORM.
- **ioredis**: Redis client library; used via redisProvider factory.
- **express**: Response type for health controller.

### Environment Variables (Required)

- `NODE_ENV`: 'development' | 'test' | 'production'
- `PORT`: Integer 1–65535
- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `BODY_JSON_LIMIT`: Size limit for JSON body (e.g., '1mb', '512kb')
- `BODY_URLENCODED_LIMIT`: Size limit for URL-encoded body
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection URL
- `HEALTH_DATABASE_TIMEOUT_MS`: Timeout for database health check (positive integer)
- `HEALTH_REDIS_TIMEOUT_MS`: Timeout for Redis health check (positive integer)
