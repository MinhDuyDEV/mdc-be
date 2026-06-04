<!-- Parent: ../AGENTS.md -->

# Realtime Module

## Purpose

The Realtime module provides WebSocket-based real-time communication for the platform. It includes two gateways: RealtimeGateway for notifications and user presence, and ChatGateway for messaging features (typing indicators, message delivery, read receipts). The module uses Socket.IO with Redis adapter for horizontal scaling and JWT-based authentication.

## Key Files

- **realtime.module.ts** - Module definition with Socket.IO and JWT configuration
- **realtime.gateway.ts** - WebSocket gateway for notifications and presence management
- **chat.gateway.ts** - WebSocket gateway for chat features (typing, message delivery)
- **realtime.service.ts** - Redis-based presence tracking with TTL
- **ws-jwt.guard.ts** - WebSocket JWT authentication guard
- **ws-current-user.decorator.ts** - Decorator to extract authenticated user from WebSocket context
- **socket-auth-token.ts** - Utility to extract JWT token from Socket.IO handshake

## Subdirectories

### adapters/
- `redis-io.adapter.ts` - Redis adapter for Socket.IO (enables multi-instance deployments)

### dto/
- `notification-event.dto.ts` - Notification payload structure
- `message-event.dto.ts` - Chat message payload structure
- `conversation-join.dto.ts` - Join conversation request
- `typing-event.dto.ts` - Typing indicator payload
- `message-read.dto.ts` - Read receipt payload

### filters/
- `ws-exception.filter.ts` - WebSocket exception filter for error handling

## For AI Agents

### Working with WebSocket Gateways

1. **RealtimeGateway** (`/realtime` namespace):
   - **Purpose**: Notifications and user presence
   - **Authentication**: JWT token verified in `afterInit()` middleware
   - **Connection Flow**:
     - Extract token from handshake (query param or auth header)
     - Verify JWT and attach user to `socket.data.user`
     - Join user-specific room: `user:${userId}`
     - Set presence in Redis with 60s TTL
   - **Disconnection Flow**:
     - Check if user has other active sockets
     - Only clear presence if no remaining sockets
   - **Presence Refresh**:
     - `@Interval(30_000)` refreshes Redis TTL every 30 seconds
     - Prevents keys from expiring while connections are active
   - **Notification Push**:
     - `pushNotification(userId, notification)` called by NotificationProcessor
     - Emits `notification:new` event to `user:${userId}` room

2. **ChatGateway** (`/chat` namespace):
   - **Purpose**: Real-time messaging features
   - **Authentication**: JWT verified in `handleConnection()`
   - **Events**:
     - `conversation:join` - Join conversation room (requires participant verification)
     - `typing:started` - Broadcast typing indicator to conversation
     - `typing:stopped` - Broadcast typing stop to conversation
     - `message:read` - Broadcast read receipt to conversation
   - **Authorization**:
     - All events verify participant status via `MessagingPolicyService.isActiveParticipant()`
     - Throws `WsException` if not authorized
   - **Message Push**:
     - `pushMessage(conversationId, message)` called by MessagingProcessor
     - Emits `message:new` event to `conversation:${conversationId}` room

3. **RealtimeService**:
   - **Presence Tracking**:
     - `setUserOnline(userId)` - Set Redis key with 60s TTL
     - `setUserOffline(userId)` - Delete Redis key
     - `isUserOnline(userId)` - Check if Redis key exists
     - `refreshPresence(userId)` - Extend TTL to 60s
   - **Redis Keys**: `presence:user:${userId}`
   - **TTL Strategy**: 60s TTL with 30s refresh interval prevents false offline status

### Room Management

- **User Rooms**: `user:${userId}` - Joined automatically on connection
- **Conversation Rooms**: `conversation:${conversationId}` - Joined via `conversation:join` event
- **Broadcasting**: Use `server.to(room).emit(event, data)` for targeted delivery
- **Excluding Sender**: Use `client.to(room).emit(event, data)` to exclude sender

### Authentication Flow

1. Client connects with JWT token in query param or auth header
2. Gateway extracts token via `extractSocketAuthToken(socket)`
3. JWT verified using `JwtService.verifyAsync()`
4. User payload attached to `socket.data.user`
5. Invalid/missing token → immediate disconnect

### Redis Adapter (Horizontal Scaling)

- Socket.IO Redis adapter enables multi-instance deployments
- All instances share room membership and event broadcasting
- Configured in `realtime.module.ts` via `adapters/redis-io.adapter.ts`
- Requires Redis connection from InfraModule

### Testing Requirements

- Test JWT authentication (valid, invalid, missing token)
- Test user room joining on connection
- Test presence tracking (online, offline, refresh)
- Test presence cleanup on last socket disconnect
- Test conversation room authorization (participant check)
- Test typing indicator broadcasting (excludes sender)
- Test message delivery to conversation room
- Test notification delivery to user room
- Test presence refresh interval (30s)
- Test Redis adapter for multi-instance scenarios

### Common Patterns

- **Authenticated Socket**: Extend Socket interface with `data.user` property
- **Room-Based Delivery**: Use rooms for targeted event broadcasting
- **Presence TTL**: 60s TTL with 30s refresh prevents false offline
- **Authorization Guards**: `@UseGuards(WsJwtGuard)` on message handlers
- **Exception Handling**: `@UseFilters(WsExceptionFilter)` for error responses
- **Validation**: `@UsePipes(ValidationPipe)` for DTO validation

### Error Handling

- `WsException`: WebSocket-specific errors (authorization, validation)
- Invalid token → disconnect immediately
- Missing participant → throw WsException
- Validation errors → WsException with field details

### Performance Considerations

- Presence refresh batched every 30s (not per-event)
- Room membership cached by Socket.IO
- Redis adapter adds ~1-2ms latency for cross-instance events
- Use `fetchSockets()` sparingly (queries all instances)

## Dependencies

### Internal
- `../infra` - Redis client for presence tracking
- `../messaging` - MessagingPolicyService for conversation authorization
- `../common/auth` - AuthenticatedUser interface

### External
- `@nestjs/websockets` - WebSocket gateway decorators
- `@nestjs/jwt` - JWT verification
- `@nestjs/schedule` - Interval decorator for presence refresh
- `socket.io` - WebSocket server and client
- `ioredis` - Redis client for presence and adapter

### Environment Variables
- `JWT_ACCESS_SECRET` - JWT signing secret
- `JWT_ACCESS_EXPIRES_IN` - JWT expiration time
- Redis connection config from InfraModule

### Database Tables
- None (presence stored in Redis, not database)
- Conversation membership verified via `messaging` module tables
