<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# connections/

## Purpose

Professional network connections module managing connection requests, acceptances, and relationship status between users. Implements LinkedIn-style connection workflow with pending/accepted/blocked states.

## Key Files

| File | Description |
|------|-------------|
| `connections.module.ts` | NestJS module configuration with ConnectionsController, ConnectionsService, and ConnectionsPolicyService |
| `connections.controller.ts` | HTTP endpoints for sending, accepting, rejecting connection requests |
| `connections.controller.spec.ts` | Unit tests for ConnectionsController |
| `connections.service.ts` | Business logic for connection lifecycle management |
| `connections.service.spec.ts` | Unit tests for ConnectionsService |
| `connections-policy.service.ts` | Authorization policies for connection operations |
| `connections-policy.service.spec.ts` | Unit tests for policy service |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for connection request/response payloads |

## For AI Agents

### Working In This Directory

- **Bidirectional relationships** — Connections are symmetric; if A connects to B, B is connected to A
- **Duplicate prevention** — Prevent duplicate connection requests between the same users
- **Privacy controls** — Users can block connection requests from specific users
- **Notifications** — Trigger notifications on connection requests and acceptances
- **Mutual connections** — Support queries for mutual connections between users

### Testing Requirements

```bash
# Unit tests
npm test -- connections.service.spec.ts
npm test -- connections-policy.service.spec.ts

# E2E tests
npm run test:e2e -- connections.e2e-spec.ts
```

### Common Patterns

**Connection Request:**
```typescript
@Post('request')
async sendRequest(
  @CurrentUser() user: User,
  @Body() dto: SendConnectionRequestDto,
) {
  // Check if already connected or request pending
  const existing = await this.connectionsService.findConnection(
    user.id,
    dto.targetUserId,
  );
  if (existing) {
    throw new ConflictException('Connection already exists');
  }

  return this.connectionsService.sendRequest(user.id, dto.targetUserId);
}
```

**Authorization Policy:**
```typescript
async canSendRequest(userId: string, targetUserId: string): Promise<boolean> {
  // Cannot send request to self
  if (userId === targetUserId) return false;

  // Check if target has blocked sender
  const blocked = await this.isBlocked(targetUserId, userId);
  if (blocked) return false;

  return true;
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and current user context
- `src/users/` — User profile information
- `src/notifications/` — Connection request notifications
- `src/common/` — Response formatting, error handling, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
