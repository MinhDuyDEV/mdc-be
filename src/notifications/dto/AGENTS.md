<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Notifications DTOs

## Purpose
Data transfer objects for notification management and user notification preferences.

## Key Files
| File | Description |
|------|-------------|
| notification.response.dto.ts | Response structure for notification data with type, content, and read status |
| update-notification-preference.dto.ts | Validates notification preference updates (email, push, in-app toggles) |

## For AI Agents

### Working In This Directory
- Notification response DTOs include type, title, body, action URL, and metadata
- Preference DTOs allow granular control per notification type (connections, messages, jobs, etc.)
- Each preference has email, push, and in-app toggles
- Notifications are marked as read/unread with timestamps
- Response DTOs include actor information (who triggered the notification)

### Testing Requirements
- Test notification response serialization with all fields
- Test preference updates with valid/invalid notification types
- Test toggle validation (boolean values)
- Verify actor information is included in responses
- Run tests: `npm test -- src/notifications`

### Common Patterns
- Response DTO: `{ id, type, title, body, actionUrl, actor: {...}, read, createdAt }`
- Preference update: `@IsEnum(NotificationType) type: NotificationType; @IsBoolean() email: boolean; @IsBoolean() push: boolean`
- Notification types: CONNECTION_REQUEST, MESSAGE_RECEIVED, APPLICATION_UPDATE, JOB_MATCH, etc.
- Actor info: `{ id, name, avatarUrl }`

## Dependencies

### Internal
- Used by `NotificationsController` for request/response validation
- Used by `NotificationsService` for business logic
- Used by `NotificationPreferenceService` for preference management
- Integrates with `../../realtime/` for real-time notifications

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
