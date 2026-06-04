<!-- Parent: ../AGENTS.md -->

# Notifications Module

## Purpose

The Notifications module manages in-app notifications for users. It provides cursor-based pagination for notification lists, tracks read status, and supports notification preferences. Notifications are created by outbox event processors and consumed via REST API.

**Key responsibilities:**
- Store and retrieve user notifications with cursor pagination
- Track read status (readAt timestamp) for each notification
- Provide unread count queries (optimized with partial index)
- Support bulk mark-as-read operations
- Manage user notification preferences (email, push, in-app toggles)

## Key Files

### Core Services

- **notifications.service.ts** - Main service for notification operations
  - `list()` - Cursor-paginated notification list (ordered by createdAt DESC, id DESC)
  - `unreadCount()` - Count unread notifications (leverages partial index)
  - `markRead()` - Mark single notification as read (idempotent)
  - `markAllRead()` - Bulk mark all unread notifications as read

- **notification-preference.service.ts** - User notification preference management
  - Manages email, push, and in-app notification toggles per notification type

### Controllers

- **notifications.controller.ts** - REST API for notifications
  - `GET /notifications` - List notifications (cursor pagination)
  - `GET /notifications/unread-count` - Get unread count
  - `PATCH /notifications/:id/read` - Mark single notification as read
  - `PATCH /notifications/read-all` - Mark all notifications as read

- **notification-preference.controller.ts** - REST API for preferences
  - `GET /notification-preferences` - Get user preferences
  - `PATCH /notification-preferences` - Update preferences

### Configuration

- **notifications.module.ts** - Module definition
  - Imports: InfraModule
  - Exports: NotificationsService

## Subdirectories

### dto/

Input validation and response DTOs:
- **list-notifications-query.dto.ts** - Query params for list endpoint (cursor, limit)
- **notification.response.dto.ts** - Notification response format with toNotificationResponse mapper
- **update-notification-preference.dto.ts** - Preference update request

## For AI Agents

### Working with Notifications

**List notifications flow:**
1. Client calls `GET /notifications?cursor=...&limit=20`
2. Service decodes cursor to (createdAt, id) pair
3. Service builds WHERE clause: `createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)`
4. Service fetches limit+1 rows to detect hasNextPage
5. Service encodes nextCursor from last item: `base64url(createdAt:id)`

**Mark read flow:**
1. Client calls `PATCH /notifications/:id/read`
2. Service validates notification belongs to user (404 if not found or wrong user)
3. Service checks if already read (skip UPDATE if readAt is set)
4. Service updates readAt to current timestamp
5. Idempotent: multiple calls return same result without extra DB writes

**Unread count:**
1. Client calls `GET /notifications/unread-count`
2. Service uses `COUNT(*) WHERE userId = ? AND readAt IS NULL`
3. Query leverages partial index `notifications_unread_idx` for performance

### Testing Requirements

**Unit tests must cover:**
- Cursor encoding/decoding (base64url format)
- Pagination with valid/invalid cursors
- hasNextPage detection (limit+1 fetch strategy)
- Mark read idempotency (already-read notifications)
- Unread count accuracy
- Bulk mark-all-read operation
- 404 for notifications belonging to other users

**Integration tests must verify:**
- Full pagination flow (first page → next page → last page)
- Cursor stability (same cursor returns same results)
- Read status updates (unread count decreases)
- Notification ordering (createdAt DESC, id DESC)
- Partial index usage for unread count queries

### Common Patterns

**Cursor pagination:**
```typescript
// Encode cursor: base64url(createdAt:id)
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}:${id}`).toString('base64url');
}

// Decode cursor
function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const lastColon = decoded.lastIndexOf(':');
  const createdAtStr = decoded.substring(0, lastColon);
  const id = decoded.substring(lastColon + 1);
  return { createdAt: new Date(createdAtStr), id };
}

// Build WHERE clause
const cursorWhere = cursor ? {
  OR: [
    { createdAt: { lt: cursorCreatedAt } },
    { createdAt: cursorCreatedAt, id: { lt: cursorId } },
  ],
} : {};
```

**Idempotent mark read:**
```typescript
const notification = await this.prisma.notification.findFirst({
  where: { id: notificationId, userId },
});

if (!notification) {
  throw new NotFoundException('NOTIFICATION_NOT_FOUND');
}

// Already read — return as-is without touching the DB
if (notification.readAt !== null) {
  return toNotificationResponse(notification);
}

const updated = await this.prisma.notification.update({
  where: { id: notificationId },
  data: { readAt: new Date() },
});
```

**Unread count with partial index:**
```typescript
// Leverages notifications_unread_idx (userId WHERE readAt IS NULL)
return this.prisma.notification.count({
  where: { userId, readAt: null },
});
```

### Notification Types

Notifications are created by outbox event processors for:
- **Connection requests** - ConnectionRequested, ConnectionAccepted
- **Application updates** - ApplicationSubmitted, ApplicationStatusChanged, ApplicationNoteAdded
- **Post interactions** - CommentAdded, ReactionAdded, MentionCreated
- **Messaging** - MessageSent (via MessagingProcessor)
- **Recruiting** - RecruiterSeatAllocated
- **Blocking** - UserBlocked

### Cursor Format

- **Encoding**: `base64url(createdAt.toISOString():id)`
- **Example**: `MjAyNi0wNS0yN1QxMDozMDowMC4wMDBaOjEyMzQ1Njc4LTkwYWItY2RlZi0xMjM0LTU2Nzg5MGFiY2RlZg==`
- **Decoding**: Split on last `:` to separate ISO date from UUID
- **Error handling**: BadRequestException('INVALID_CURSOR') for malformed cursors

### Pagination Limits

- **Default limit**: 20 notifications per page
- **Min limit**: 1
- **Max limit**: 50 (clamped in service)
- **hasNextPage**: Detected by fetching limit+1 rows

### Error Handling

- `NotFoundException('NOTIFICATION_NOT_FOUND')` - Notification doesn't exist or belongs to another user
- `BadRequestException('INVALID_CURSOR')` - Malformed cursor string

## Dependencies

### Internal Modules
- **infra/prisma** - Database access (Notification table)
- **common/auth** - Authentication (CurrentUser decorator)
- **common/pagination** - Cursor pagination types (CursorPaginationMeta)

### External Dependencies
- **@nestjs/common** - NestJS framework
- **@prisma/client** - Database client

### Database Schema
- **notifications** - Stores notification records (userId, type, title, body, metadata, readAt, createdAt)
- **notification_preferences** - User preferences for notification channels (email, push, in-app)

### Indexes
- **notifications_unread_idx** - Partial index on (userId) WHERE readAt IS NULL (optimizes unread count queries)
- **notifications_user_created_idx** - Index on (userId, createdAt DESC, id DESC) for pagination

### Outbox Events Emitted
- None (notifications are a leaf domain)

### Outbox Events Consumed
- Notifications are created by outbox event processors:
  - **NotificationProcessor** - Processes application, connection, post, and recruiting events
  - **MessagingProcessor** - Processes MessageSent events
