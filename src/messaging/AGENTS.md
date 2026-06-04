<!-- Parent: ../AGENTS.md -->

# Messaging Module

## Purpose

The Messaging module implements direct messaging between users with support for both general conversations and recruiting-specific conversations. It enforces blocking rules, recruiter seat policies, and provides cursor-based pagination for conversations and messages.

**Key responsibilities:**
- Create and manage direct (1:1) conversations between users
- Send and retrieve messages with cursor pagination
- Enforce blocking policies (users cannot message blocked users)
- Enforce recruiting policies (recruiters need active seats to message candidates)
- Track conversation read status and last message metadata
- Emit outbox events for conversation creation and message sending

## Key Files

### Core Services

- **messaging.service.ts** - Main service for conversation and message operations
  - `createConversation()` - Creates DIRECT conversation with blocking checks
  - `createRecruitingConversation()` - Creates conversation with recruiter seat validation
  - `listConversations()` - Cursor-paginated list of user's conversations
  - `getConversation()` - Retrieves single conversation with participants
  - `sendMessage()` - Sends message with blocking checks and outbox event
  - `getMessages()` - Cursor-paginated message history
  - `markRead()` - Updates lastReadAt for conversation participant

- **messaging-policy.service.ts** - Policy enforcement for messaging operations
  - `canCreateConversation()` - Checks if users can start a conversation (blocking rules)
  - `canSendMessage()` - Validates message sending permissions
  - `isActiveParticipant()` - Verifies user is an active conversation participant

### Controllers

- **messaging.controller.ts** - REST API for messaging
  - `POST /conversations` - Create general conversation
  - `POST /conversations/recruiting` - Create recruiting conversation
  - `GET /conversations` - List user's conversations (cursor pagination)
  - `GET /conversations/:id` - Get single conversation
  - `POST /conversations/:id/messages` - Send message (rate-limited: 30/min)
  - `GET /conversations/:id/messages` - Get message history (cursor pagination)
  - `PATCH /conversations/:id/read` - Mark conversation as read

### Configuration

- **messaging.module.ts** - Module definition
  - Imports: InfraModule, OutboxCoreModule, ConnectionsModule, RecruitingModule
  - Exports: MessagingService, MessagingPolicyService

## Subdirectories

### dto/

Input validation and response DTOs:
- **create-conversation.dto.ts** - Conversation creation request (participantIds)
- **create-recruiting-conversation.dto.ts** - Recruiting conversation request (candidateUserId)
- **send-message.dto.ts** - Message sending request (content)
- **conversation-response.dto.ts** - Conversation response format
- **message-response.dto.ts** - Message response format

## For AI Agents

### Working with Messaging

**Conversation creation flow:**
1. Client calls `POST /conversations` with target user ID
2. Service checks blocking status via MessagingPolicyService
3. Service uses canonical key (sorted user IDs) for idempotency
4. Transaction: check existing conversation → claim idempotency key → create conversation
5. Service emits `ConversationCreated` event

**Recruiting conversation flow:**
1. Recruiter calls `POST /conversations/recruiting` with candidate ID
2. Service validates recruiter has active seat via RecruitingPolicyService
3. Same idempotency and transaction pattern as general conversations
4. Returns existing conversation if already exists

**Message sending flow:**
1. Client calls `POST /conversations/:id/messages` with content
2. Service validates participant status and blocking rules
3. Transaction: create message → update conversation lastMessageAt → emit event
4. Monotonic guard prevents concurrent sends from overwriting lastMessageAt with older values
5. Service emits `MessageSent` event with recipientIds for notification processing

### Testing Requirements

**Unit tests must cover:**
- Conversation creation with valid/blocked users
- Self-conversation prevention (user cannot message themselves)
- Idempotency (duplicate conversation creation returns existing)
- Recruiting conversation with valid/invalid recruiter seats
- Message sending with blocking checks
- Cursor pagination for conversations and messages
- Read status tracking (lastReadAt updates)

**Integration tests must verify:**
- Full conversation flow (create → send → read)
- Outbox event emission (ConversationCreated, MessageSent)
- Concurrent conversation creation (idempotency key collision)
- Concurrent message sending (monotonic lastMessageAt guard)
- Rate limiting (30 messages per minute)
- Blocking enforcement (blocked users cannot message)
- Recruiter seat validation (inactive seats cannot message)

### Common Patterns

**Create conversation with idempotency:**
```typescript
// Canonical key prevents duplicate conversations
const canonicalKey = [userId, targetUserId].sort().join(':');

await this.prisma.$transaction(async (tx) => {
  // Check existing first
  const existing = await tx.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  });
  if (existing) return existing;

  // Claim idempotency key
  await this.idempotencyService.claim('Conversation:create', canonicalKey);

  // Create conversation
  const conversation = await tx.conversation.create({
    data: {
      type: 'DIRECT',
      participants: {
        createMany: {
          data: [
            { userId, role: 'MEMBER' },
            { userId: targetUserId, role: 'MEMBER' },
          ],
        },
      },
    },
  });

  await this.outboxService.emit(tx, {
    eventType: 'ConversationCreated',
    aggregateType: 'Conversation',
    aggregateId: conversation.id,
    payload: { conversationId: conversation.id, participantIds: [userId, targetUserId] },
  });

  return conversation;
});
```

**Send message with monotonic guard:**
```typescript
await tx.conversation.updateMany({
  where: {
    id: conversationId,
    OR: [
      { lastMessageAt: null },
      { lastMessageAt: { lt: message.createdAt } },
    ],
  },
  data: {
    lastMessageAt: message.createdAt,
    lastMessagePreview: preview,
  },
});
```

**Cursor pagination:**
```typescript
// Encode cursor: base64(JSON({createdAt, id}))
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
  ).toString('base64');
}

// Decode and build WHERE clause
const decoded = decodeCursor(cursor);
where.OR = [
  { createdAt: { lt: new Date(decoded.createdAt) } },
  { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
];
```

### Policy Enforcement

**Blocking rules:**
- Users cannot create conversations with blocked users
- Users cannot send messages to blocked users
- Blocking is bidirectional (blocker and blocked cannot message)

**Recruiting rules:**
- Recruiters must have active seats to message candidates
- Seat validation via RecruitingPolicyService.canMessageCandidate()
- Returns ForbiddenException with reason if seat is inactive

**Participant rules:**
- Only active participants (leftAt IS NULL) can send/read messages
- Participant status checked via MessagingPolicyService.isActiveParticipant()

### Error Handling

- `BadRequestException('SELF_CONVERSATION')` - User tried to message themselves
- `BadRequestException('BLOCKED_USER')` - Blocked user relationship exists
- `ForbiddenException(decision.reason)` - Recruiter seat validation failed
- `ForbiddenException('NOT_A_PARTICIPANT')` - User is not an active participant
- `BadRequestException('CONVERSATION_NOT_FOUND')` - Conversation doesn't exist

## Dependencies

### Internal Modules
- **infra/prisma** - Database access (Conversation, Message, ConversationParticipant)
- **outbox** - Event emission (ConversationCreated, MessageSent)
- **connections** - Blocking status checks
- **recruiting** - Recruiter seat validation
- **common/pagination** - Cursor pagination utilities

### External Dependencies
- **@nestjs/common** - NestJS framework
- **@nestjs/throttler** - Rate limiting (30 messages/min)
- **@prisma/client** - Database client

### Database Schema
- **conversations** - Stores conversation metadata (type, lastMessageAt, lastMessagePreview)
- **conversation_participants** - Tracks participants (userId, role, leftAt, lastReadAt)
- **messages** - Stores message content (conversationId, senderId, content, type)
- **idempotency_keys** - Prevents duplicate conversation creation

### Outbox Events Emitted
- **ConversationCreated** - After conversation creation (payload: conversationId, participantIds)
- **MessageSent** - After message sending (payload: messageId, conversationId, senderId, recipientIds)

### Outbox Events Consumed
- None (messaging is a leaf domain in the event flow)
