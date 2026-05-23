<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Realtime DTOs

## Purpose
Data transfer objects for WebSocket events including conversation joins, message events, typing indicators, read receipts, and notifications.

## Key Files
| File | Description |
|------|-------------|
| conversation-join.dto.ts | Validates conversation join events (conversation ID) |
| message-event.dto.ts | Validates real-time message events (conversation ID, message data) |
| message-read.dto.ts | Validates message read receipt events (message IDs) |
| typing-event.dto.ts | Validates typing indicator events (conversation ID, user ID) |
| notification-event.dto.ts | Validates real-time notification events (notification data) |

## For AI Agents

### Working In This Directory
- WebSocket DTOs validate event payloads for real-time communication
- Conversation join events subscribe clients to conversation rooms
- Message events deliver new messages to conversation participants
- Typing indicators show when users are composing messages (debounced)
- Read receipts update message read status in real-time
- Notification events deliver instant notifications to users

### Testing Requirements
- Test DTO validation for all event types
- Test conversation room subscription/unsubscription
- Test message delivery to correct conversation participants
- Test typing indicator debouncing (stop after 3s of inactivity)
- Test read receipt batching (multiple messages marked read at once)
- Run tests: `npm test -- src/realtime`

### Common Patterns
- Join conversation: `socket.emit('conversation:join', { conversationId })`
- New message: `socket.on('message:new', (data: MessageEventDto) => ...)`
- Typing indicator: `socket.emit('typing:start', { conversationId })`
- Read receipt: `socket.emit('message:read', { messageIds: [...] })`
- Notification: `socket.on('notification:new', (data: NotificationEventDto) => ...)`

## Dependencies

### Internal
- Used by `../chat.gateway.ts` and `../realtime.gateway.ts` for event handling
- Integrates with `../../messaging/` for message delivery
- Integrates with `../../notifications/` for notification delivery

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/websockets` — WebSocket decorators and utilities

<!-- MANUAL: -->
