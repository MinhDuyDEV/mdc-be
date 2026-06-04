<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/infra

## Purpose

Core infrastructure services providing database access, caching, storage, search engine, email, logging, health checks, and observability. All domain modules import InfraModule to access these foundational services.

## Key Files

| File | Description |
|------|-------------|
| `infra.module.ts` | Module configuration with global providers and exports for all infrastructure services |
| `index.ts` | Barrel export for all infrastructure services |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `config/` | Environment variable validation and configuration schema |
| `health/` | Health check controller and service aggregating all subsystem health |
| `logger/` | Structured logging with Pino (LoggerModule) |
| `mailer/` | Email service with Nodemailer transporter |
| `observability/` | OpenTelemetry instrumentation and shutdown service |
| `prisma/` | Prisma ORM service with transaction support |
| `redis/` | Redis client provider and health checks |
| `scheduling/` | Leader election and distributed locking for cron jobs |
| `search-engine/` | Elasticsearch client provider and health checks |
| `storage/` | S3-compatible object storage service and health checks |

## For AI Agents

### Working In This Directory

- **Database Access Pattern**: Inject `PrismaService` for all database operations, use `prisma.withTransaction()` for multi-operation transactions, transaction options configured via environment variables
- **Caching Pattern**: Inject `REDIS_CLIENT` token to access Redis client, use Redis for session storage, rate limiting, idempotency keys, graceful degradation: log warnings if Redis unavailable
- **Storage Pattern**: Inject `StorageService` for S3-compatible object storage, use `STORAGE_CLIENT` token for direct client access, supports presigned URLs for direct uploads/downloads
- **Search Engine Pattern**: Inject `SearchEngineService` for Elasticsearch operations, use `SEARCH_ENGINE_CLIENT` token for direct client access, graceful degradation: log warnings if ES unavailable
- **Email Pattern**: Inject `MailerService` for sending emails, use `MAILER_TRANSPORTER` token for direct transporter access, templates and layouts in separate template engine
- **Logging Pattern**: Inject `PinoLogger` for structured logging, always call `logger.setContext(ClassName.name)` in constructor, use log levels: trace, debug, info, warn, error, fatal
- **Health Checks Pattern**: `HealthController` exposes `/health` endpoint, `HealthService` aggregates all subsystem health checks, returns 200 OK if all healthy, 503 Service Unavailable if any unhealthy
- **Distributed Scheduling Pattern**: Inject `LeaderLockService` for leader election, use `acquireLeaderLock()` before running cron jobs, prevents duplicate execution in multi-instance deployments

### Testing Requirements

- Test PrismaService connects and disconnects correctly
- Test transaction rollback on callback error
- Test Redis health check detects unavailable Redis
- Test storage health check detects unavailable S3
- Test search engine health check detects unavailable ES
- Test mailer health check detects unavailable SMTP
- Test health endpoint returns 503 when any subsystem unhealthy
- Test leader lock prevents concurrent cron execution
- Mock external clients (Redis, S3, ES, SMTP) for unit tests

### Common Patterns

```typescript
// Database transaction
await this.prisma.withTransaction(async (tx) => {
  await tx.user.create({ data: { ... } });
  await tx.auditLog.create({ data: { ... } });
});

// Redis caching
const cached = await this.redis.get(`cache:${key}`);
if (cached) return JSON.parse(cached);
const result = await this.fetchData();
await this.redis.setex(`cache:${key}`, 3600, JSON.stringify(result));

// S3 upload
const url = await this.storage.uploadFile(
  'avatars',
  `${userId}.jpg`,
  buffer,
  'image/jpeg'
);

// Elasticsearch indexing
await this.searchEngine.index('profiles', profileId, {
  displayName: profile.displayName,
  headline: profile.headline,
  skills: profile.skills,
});

// Email sending
await this.mailer.sendMail({
  to: user.email,
  subject: 'Welcome to MDC',
  template: 'welcome',
  context: { displayName: user.displayName },
});

// Structured logging
this.logger.info(
  { userId, action: 'profile_created' },
  'User profile created successfully'
);

// Leader election for cron
@Cron('0 0 * * *')
async dailyCleanup() {
  const lock = await this.leaderLock.acquireLeaderLock('daily-cleanup', 60000);
  if (!lock) return; // Another instance is leader
  try {
    await this.performCleanup();
  } finally {
    await this.leaderLock.releaseLeaderLock('daily-cleanup');
  }
}
```

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
