<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# admin/

## Purpose

Administrative operations module providing privileged endpoints for platform management. Handles user management, content moderation actions, system configuration, and administrative reporting. Restricted to users with admin roles.

## Key Files

| File | Description |
|------|-------------|
| `admin.module.ts` | NestJS module configuration with AdminController and AdminService |
| `admin.controller.ts` | HTTP endpoints for admin operations (user management, moderation, reports) |
| `admin.service.ts` | Business logic for administrative actions with authorization checks |
| `admin.service.spec.ts` | Unit tests for AdminService |
| `index.ts` | Barrel export for public API |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for admin request/response payloads |

## For AI Agents

### Working In This Directory

- **Authorization required** — All admin endpoints must verify admin role via guards
- **Audit logging** — Log all administrative actions to AuditLog table
- **Dangerous operations** — User deletion, content removal, and account suspension require extra validation
- **Rate limiting** — Apply stricter rate limits to admin endpoints to prevent abuse
- **Response format** — Follow standard API envelope: `{ data: { ... } }`

### Testing Requirements

```bash
# Unit tests
npm test -- admin.service.spec.ts

# E2E tests (if applicable)
npm run test:e2e -- admin.e2e-spec.ts
```

### Common Patterns

**Admin Guard:**
```typescript
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  // All routes require admin role
}
```

**Audit Logging:**
```typescript
await this.auditLogService.log({
  actorUserId: currentUser.id,
  action: 'USER_SUSPENDED',
  entityType: 'User',
  entityId: targetUserId,
  metadata: { reason, duration },
});
```

## Dependencies

### Internal

- `src/auth/` — Authentication and authorization guards
- `src/users/` — User management operations
- `src/common/` — Response formatting, error handling, validation
- `src/infra/prisma/` — Database access via PrismaService

### External

- `@nestjs/common` — Controller, Injectable, UseGuards decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
