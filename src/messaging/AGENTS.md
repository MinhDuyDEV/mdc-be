<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# messaging/

## Purpose

Direct messaging module enabling private conversations between connected users. Handles message sending, retrieval, read receipts, and conversation management.

## Key Files

| File | Description |
|------|-------------|
| `messaging.module.ts` | NestJS module configuration with MessagingController, MessagingService, and MessagingPolicyService |
| `messaging.controller.ts` | HTTP endpoints for sending messages and retrieving conversations |
| `messaging.controller.spec.ts` | Unit tests for MessagingController |
| `messaging.service.ts` | Business logic for message delivery and conversation management |
| `messaging.service.spec.ts` | Unit tests for MessagingService |
| `messaging-policy.service.ts` | Authorization policies for messaging operations |
| `messaging-policy.service.spec.ts` | Unit tests for policy service |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for messaging request/response payloads |

## For AI Agents

### Working In This Directory

- **Privacy enforcement** — Users can only message their connections (unless settings allow otherwise)
- **Real-time delivery** — Integrate with WebSocket gateway for instant message delivery
- **Read receipts** — Track message read status and timestamps
- **Conversation threading** — Group messages by conversation/thread
- **Notifications** — Trigger push notifications for new messages
- **Message history** — Support pagination for loading older messages

### Testing Requirements

```bash
# Unit tests
npm test -- messaging.service.spec.ts
npm test -- messaging-policy.service.spec.ts

# E2E tests
npm run test:e2e -- messaging.e2e-spec.ts
```

### Common Patterns

**Send Message:**
```typescript
@Post('send')
async sendMessage(
  @CurrentUser() user: User,
  @Body() dto: SendMessageDto,
) {
  // Check if users are connected
  await this.messagingPolicyService.canMessage(user.id, dto.recipientId);
  
  const message = await this.messagingService.send({
    senderId: user.id,
    recipientId: dto.recipientId,
    content: dto.content,
  });
  
  // Emit real-time event
  this.realtimeGateway.emitToUser(dto.recipientId, 'message:new', message);
  
  return { data: message };
}
```

**Get Conversation:**
```typescript
@Get('conversations/:userId')
async getConversation(
  @CurrentUser() user: User,
  @Param('userId') otherUserId: string,
  @Query() dto: PaginationDto,
) {
  const messages = await this.messagingService.getConversation(
    user.id,
    otherUserId,
    dto.cursor,
    dto.limit,
  );
  return { data: messages, meta: { nextCursor: messages[messages.length - 1]?.id } };
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and current user context
- `src/connections/` — Connection verification
- `src/realtime/` — WebSocket integration for live messages
- `src/notifications/` — Push notifications for new messages
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
