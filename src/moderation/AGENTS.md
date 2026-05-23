<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# moderation/

## Purpose

Content moderation module providing tools for reviewing, flagging, and removing inappropriate content. Implements automated filtering, manual review workflows, and user reporting mechanisms.

## Key Files

| File | Description |
|------|-------------|
| `moderation.module.ts` | NestJS module configuration with ModerationController, ModerationService, and ModerationPolicyService |
| `moderation.controller.ts` | HTTP endpoints for content review and moderation actions |
| `moderation.service.ts` | Business logic for content filtering, review queues, and moderation actions |
| `moderation.service.spec.ts` | Unit tests for ModerationService |
| `moderation-policy.service.ts` | Authorization policies for moderation operations |
| `index.ts` | Barrel export for public API |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for moderation request/response payloads |

## For AI Agents

### Working In This Directory

- **Authorization** — Only moderators and admins can perform moderation actions
- **Audit trail** — Log all moderation actions with timestamps and moderator information
- **User reports** — Allow users to flag inappropriate content for review
- **Automated filtering** — Implement keyword/pattern-based content filtering
- **Review queue** — Maintain a queue of flagged content for manual review
- **Appeal process** — Support appeals for moderation decisions

### Testing Requirements

```bash
# Unit tests
npm test -- moderation.service.spec.ts
npm test -- moderation-policy.service.spec.ts

# E2E tests
npm run test:e2e -- moderation.e2e-spec.ts
```

### Common Patterns

**Flag Content:**
```typescript
@Post('flag')
async flagContent(
  @CurrentUser() user: User,
  @Body() dto: FlagContentDto,
) {
  const report = await this.moderationService.flagContent({
    reporterId: user.id,
    contentType: dto.contentType,
    contentId: dto.contentId,
    reason: dto.reason,
  });
  
  // Add to review queue
  await this.moderationService.addToReviewQueue(report);
  
  return { data: report };
}
```

**Moderate Content:**
```typescript
@Post('moderate')
@UseGuards(AuthGuard, ModeratorGuard)
async moderateContent(
  @CurrentUser() moderator: User,
  @Body() dto: ModerateContentDto,
) {
  const result = await this.moderationService.moderate({
    moderatorId: moderator.id,
    contentType: dto.contentType,
    contentId: dto.contentId,
    action: dto.action, // 'approve' | 'remove' | 'warn'
    reason: dto.reason,
  });
  
  // Log moderation action
  await this.auditLogService.log({
    actorUserId: moderator.id,
    action: 'CONTENT_MODERATED',
    entityType: dto.contentType,
    entityId: dto.contentId,
    metadata: { action: dto.action, reason: dto.reason },
  });
  
  return { data: result };
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and authorization
- `src/posts/` — Post content moderation
- `src/users/` — User account moderation
- `src/common/` — Response formatting, error handling, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
