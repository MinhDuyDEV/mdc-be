<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Realtime Adapters

## Purpose
Socket.IO adapters for scaling WebSocket connections across multiple server instances using Redis pub/sub.

## Key Files
| File | Description |
|------|-------------|
| redis-io.adapter.ts | Redis adapter configuration for Socket.IO horizontal scaling |

## For AI Agents

### Working In This Directory
- Redis adapter enables WebSocket communication across multiple server instances
- Adapter uses Redis pub/sub for broadcasting messages to all connected clients
- Configuration includes Redis connection settings and adapter options
- Adapter handles connection pooling and automatic reconnection
- Required for production deployments with multiple server instances

### Testing Requirements
- Test adapter initialization with valid/invalid Redis config
- Test message broadcasting across multiple server instances
- Test reconnection behavior on Redis connection loss
- Verify connection pooling and resource cleanup
- Run tests: `npm test -- src/realtime/adapters`

### Common Patterns
- Adapter setup: `io.adapter(createAdapter(redisClient, redisSubscriber))`
- Broadcasting: `io.emit('event', data)` broadcasts to all servers
- Room-based: `io.to('room').emit('event', data)` broadcasts to room across servers
- Namespace support: `io.of('/namespace').adapter(...)` for isolated channels

## Dependencies

### Internal
- Used by `../realtime.module.ts` for Socket.IO configuration
- Integrates with `../../infra/redis/` for Redis connection

### External
- `socket.io` — WebSocket server library
- `@socket.io/redis-adapter` — Redis adapter for Socket.IO
- `ioredis` — Redis client library

<!-- MANUAL: -->
