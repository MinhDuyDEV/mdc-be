<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# realtime/

## Purpose

Real-time communication module providing WebSocket connections for live updates. Handles notifications, messages, presence, and feed updates via Socket.IO with Redis adapter for horizontal scaling.

## Key Files

| File | Description |
|------|-------------|
| `realtime.module.ts` | NestJS module configuration with gateways and services |
| `realtime.gateway.ts` | Main WebSocket gateway for general real-time events |
| `realtime.service.ts` | Business logic for broadcasting events to connected clients |
| `chat.gateway.ts` | Dedicated gateway for chat/messaging real-time events |
| `ws-jwt.guard.ts` | WebSocket authentication guard using JWT tokens |
| `ws-current-user.decorator.ts` | Decorator to extract current user from WebSocket context |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `adapters/` | Socket.IO adapters (Redis adapter for multi-instance support) |
| `dto/` | Data transfer objects for WebSocket event payloads |
| `filters/` | WebSocket exception filters for error handling |

## For AI Agents

### Working In This Directory

- **Authentication** — All WebSocket connections must authenticate via JWT
- **Redis adapter** — Use Redis adapter for broadcasting across multiple server instances
- **Room management** — Use Socket.IO rooms for targeted broadcasting (user-specific, conversation-specific)
- **Error handling** — Implement WebSocket exception filters for graceful error responses
- **Connection lifecycle** — Handle connect, disconnect, and reconnection events
- **Rate limiting** — Apply rate limits to prevent WebSocket abuse

### Testing Requirements

```bash
# Unit tests
npm test -- realtime.service.spec.ts

# E2E tests (WebSocket testing)
npm run test:e2e -- realtime.e2e-spec.ts
```

### Common Patterns

**WebSocket Gateway:**
```typescript
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGINS?.split(',') },
})
@UseGuards(WsJwtGuard)
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(@WsCurrentUser() user: User, @MessageBody() data: any) {
    // Join user-specific room
    this.server.to(user.id).emit('subscribed', { userId: user.id });
  }
}
```

**Broadcasting to User:**
```typescript
emitToUser(userId: string, event: string, data: any) {
  this.server.to(userId).emit(event, data);
}
```

**Redis Adapter Setup:**
```typescript
const redisAdapter = createAdapter(
  createClient({ url: process.env.REDIS_URL }),
  createClient({ url: process.env.REDIS_URL }),
);
this.server.adapter(redisAdapter);
```

## Dependencies

### Internal

- `src/auth/` — JWT authentication for WebSocket connections
- `src/notifications/` — Real-time notification delivery
- `src/messaging/` — Real-time message delivery
- `src/common/` — Error handling, validation
- `src/infra/redis/` — Redis client for Socket.IO adapter

### External

- `@nestjs/websockets` — WebSocket decorators and utilities
- `@nestjs/platform-socket.io` — Socket.IO platform adapter
- `socket.io` — WebSocket server
- `@socket.io/redis-adapter` — Redis adapter for horizontal scaling

<!-- MANUAL: -->
