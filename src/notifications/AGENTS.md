<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# notifications/

## Purpose

Notification system managing in-app notifications, push notifications, and user notification preferences. Handles notification creation, delivery, read status, and user settings.

## Key Files

| File | Description |
|------|-------------|
| `notifications.module.ts` | NestJS module configuration with NotificationsController, NotificationsService, and NotificationPreferenceController |
| `notifications.controller.ts` | HTTP endpoints for retrieving and managing notifications |
| `notifications.controller.spec.ts` | Unit tests for NotificationsController |
| `notifications.service.ts` | Business logic for notification creation and delivery |
| `notifications.service.spec.ts` | Unit tests for NotificationsService |
| `notification-preference.controller.ts` | HTTP endpoints for managing notification preferences |
| `notification-preference.service.ts` | Business logic for user notification settings |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for notification request/response payloads |

## For AI Agents

### Working In This Directory

- **Real-time delivery** — Integrate with WebSocket gateway for instant notification delivery
- **Notification types** — Support various types: connection requests, messages, post reactions, job applications, etc.
- **User preferences** — Respect user notification settings (email, push, in-app)
- **Read status** — Track which notifications have been read
- **Batching** — Group similar notifications to reduce noise
- **Unread count** — Provide efficient queries for unread notification counts

### Testing Requirements

```bash
# Unit tests
npm test -- notifications.service.spec.ts

# E2E tests
npm run test:e2e -- notifications.e2e-spec.ts
```

### Common Patterns

**Create Notification:**
```typescript
async createNotification(data: CreateNotificationData) {
  // Check user preferences
  const preferences = await this.getPreferences(data.userId);
  if (!preferences.enabled[data.type]) {
    return; // User has disabled this notification type
  }
  
  const notification = await this.prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      metadata: data.metadata,
    },
  });
  
  // Emit real-time event
  this.realtimeGateway.emitToUser(data.userId, 'notification:new', notification);
  
  // Send push notification if enabled
  if (preferences.push[data.type]) {
    await this.pushService.send(data.userId, notification);
  }
  
  return notification;
}
```

**Get Notifications:**
```typescript
@Get()
async getNotifications(
  @CurrentUser() user: User,
  @Query() dto: PaginationDto,
) {
  const notifications = await this.notificationsService.getForUser(
    user.id,
    dto.cursor,
    dto.limit,
  );
  
  const unreadCount = await this.notificationsService.getUnreadCount(user.id);
  
  return {
    data: notifications,
    meta: {
      nextCursor: notifications[notifications.length - 1]?.id,
      unreadCount,
    },
  };
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and current user context
- `src/realtime/` — WebSocket integration for live notifications
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
