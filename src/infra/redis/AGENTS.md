<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/infra/redis

## Purpose

Redis cache client provider and health service. Manages ioredis connection lifecycle with lazy connect, provides a singleton Redis client injected globally via REDIS_CLIENT symbol, and implements health checks with timeout protection. Handles graceful shutdown and connection state management.

## Key Files

| File | Description |
|------|-------------|
| `redis.provider.ts` | Factory function that creates and configures ioredis Redis client; uses lazy connect and offline queue disabled |
| `redis.constants.ts` | Exports REDIS_CLIENT symbol used for dependency injection |
| `redis-health.service.ts` | Service that implements Redis health checks (ping) with timeout logic; handles lazy connect and graceful shutdown |
| `index.ts` | Barrel export; re-exports constants, health service, and provider |

## For AI Agents

### Working In This Directory

- **Lazy connect**: Redis client is created with lazyConnect: true; it does not connect until explicitly told to do so (via RedisHealthService.ping() or manual connect()).
- **Offline queue disabled**: enableOfflineQueue: false means commands are rejected if the client is not connected; this prevents silent failures.
- **Max retries**: maxRetriesPerRequest: 1 limits retry attempts to prevent hanging on network issues.
- **Dependency injection**: Inject Redis client using `@Inject(REDIS_CLIENT)` in service constructors.
- **Health checks**: RedisHealthService.ping() connects if needed, sends PING command, and verifies response is 'PONG'.
- **Timeout protection**: Health checks use Promise.race() to enforce configurable timeout (HEALTH_REDIS_TIMEOUT_MS).
- **Graceful shutdown**: RedisHealthService.onApplicationShutdown() closes the connection cleanly; falls back to disconnect() if quit() fails.

### Testing Requirements

- **Unit tests**: Mock ioredis Redis client; test provider factory, health service ping, timeout scenarios, shutdown behavior.
- **Test cases**: Happy path (ping returns PONG), connection fails, timeout occurs, shutdown with connected/disconnected client.
- **Mocking**: Use jest.mock('ioredis') or provide a test double that implements Redis interface.
- **Integration tests**: Use real Redis instance (Docker container or local Redis); test actual connection and commands.
- **Run tests**: `npm test -- src/infra/redis` runs redis tests only.

### Common Patterns

- **Injection pattern**: Use `@Inject(REDIS_CLIENT)` to inject the Redis client; never instantiate directly.
- **Connection state**: Check redis.status before operations; status values are 'wait' (not connected), 'connecting', 'ready', 'end' (closed).
- **Error handling**: Catch Redis errors and convert to NestJS exceptions; handle connection errors gracefully.
- **Timeout wrapper**: withTimeout() is a private method that wraps async operations with Promise.race(); reused for health checks.
- **Async lifecycle**: RedisHealthService implements OnApplicationShutdown; NestJS calls onApplicationShutdown() during app shutdown.

## Dependencies

### Internal

- **config/**: Uses AppConfig interface and ConfigService to access REDIS_URL and health check timeout.

### External

- **@nestjs/common**: Inject, Injectable, OnApplicationShutdown decorators.
- **@nestjs/config**: ConfigService for accessing configuration.
- **ioredis**: Redis client library; provides Redis class and connection management.

### Environment Variables (from config/)

- `REDIS_URL`: Redis connection URL (required; e.g., 'redis://localhost:6379').
- `HEALTH_REDIS_TIMEOUT_MS`: Timeout for Redis health check (positive integer, milliseconds).

## Usage Examples

### Injecting the Redis Client

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT, type RedisClient } from '../redis';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
}
```

### Health Check Integration

RedisHealthService is automatically injected into HealthService and called during `/health/ready` probes. No manual integration needed.

## Connection Lifecycle

1. **App startup**: NestJS initializes InfraModule, which provides redisProvider.
2. **Provider factory**: redisProvider creates Redis client with lazyConnect: true; client is not connected yet.
3. **First use**: RedisHealthService.ping() or any command triggers lazy connect.
4. **App running**: Redis client is connected and ready for commands.
5. **App shutdown**: NestJS calls onApplicationShutdown() on RedisHealthService; it calls redis.quit() to close the connection gracefully.
6. **Connection pool**: ioredis manages connection pooling internally; individual commands reuse the connection.
