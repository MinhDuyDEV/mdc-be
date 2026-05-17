<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/infra/health

## Purpose

Health check endpoints and service for Kubernetes/orchestration readiness and liveness probes. Exposes `/health/live` (always returns 200) and `/health/ready` (returns 200 if all dependencies are up, 503 if any are down). Implements timeout wrappers to prevent health checks from hanging.

## Key Files

| File | Description |
|------|-------------|
| `health.controller.ts` | NestJS controller; routes GET /health/live and GET /health/ready to HealthService methods |
| `health.service.ts` | Service that checks database (Prisma) and Redis connectivity; implements timeout logic using Promise.race() |
| `index.ts` | Barrel export; re-exports HealthController and HealthService |

## For AI Agents

### Working In This Directory

- **Liveness probe**: `/health/live` always returns 200 with status 'ok'; used by orchestrators to detect if the app process is running.
- **Readiness probe**: `/health/ready` checks database and Redis connectivity; returns 200 if all up, 503 if any down; used by orchestrators to route traffic.
- **Timeout pattern**: Both database and Redis checks use Promise.race() to enforce configurable timeouts (HEALTH_DATABASE_TIMEOUT_MS, HEALTH_REDIS_TIMEOUT_MS).
- **Dependency injection**: HealthService injects PrismaService, RedisHealthService, and ConfigService; HealthController injects HealthService.
- **Response format**: HealthResponse includes status ('ok' | 'error') and checks object with per-dependency status ('up' | 'down').
- **Error handling**: Exceptions in health checks are caught and converted to 'down' status; the overall status becomes 'error' if any dependency is down.

### Testing Requirements

- **Unit tests**: `health.service.spec.ts` tests both live() and ready() methods.
- **Test cases**: Mock PrismaService and RedisHealthService; test happy path (all up), database down, Redis down, timeout scenarios.
- **Timeout testing**: Verify that health checks respect configured timeouts and do not hang indefinitely.
- **Response validation**: Verify response structure and status codes (200 for live, 200 for ready/all-up, 503 for ready/any-down).
- **Run tests**: `npm test -- src/infra/health` runs health tests only.

### Common Patterns

- **Timeout wrapper**: withTimeout() is a private method that wraps any async operation with a timeout; reused for both database and Redis checks.
- **Graceful degradation**: If one dependency is down, the health check still completes and reports the status; it does not fail the entire check.
- **Dependency status**: Each dependency (api, postgres, redis) has its own status field; this allows clients to see which specific dependency is down.
- **Immutable response**: HealthResponse is constructed once and returned; it is not modified after creation.
- **Async lifecycle**: ready() is async; live() is synchronous (no I/O).

## Dependencies

### Internal

- **config/**: Uses AppConfig interface and ConfigService to access health check timeouts.
- **prisma/**: Uses PrismaService to check database connectivity.
- **redis/**: Uses RedisHealthService to check Redis connectivity.

### External

- **@nestjs/common**: Controller, Get, HttpCode, HttpStatus, Res, Injectable decorators.
- **@nestjs/config**: ConfigService for accessing configuration.
- **express**: Response type for passthrough response handling.

### Configuration (from config/)

- `HEALTH_DATABASE_TIMEOUT_MS`: Timeout for database health check (positive integer, milliseconds).
- `HEALTH_REDIS_TIMEOUT_MS`: Timeout for Redis health check (positive integer, milliseconds).

## Orchestration Integration

- **Kubernetes liveness probe**: `GET /health/live` (always 200; detects if process is alive).
- **Kubernetes readiness probe**: `GET /health/ready` (200 if ready, 503 if not; detects if app can handle traffic).
- **Probe configuration**: Set initialDelaySeconds, periodSeconds, timeoutSeconds, and failureThreshold in Kubernetes deployment manifest.
- **Timeout coordination**: Ensure Kubernetes probe timeout is greater than HEALTH_DATABASE_TIMEOUT_MS + HEALTH_REDIS_TIMEOUT_MS to allow health checks to complete.
