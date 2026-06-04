<!-- Parent: ../AGENTS.md -->

# Admin Domain

## Purpose

Administrative operations for platform management. Provides privileged endpoints for managing users, companies, jobs, and outbox dead-letter queue operations. All routes require admin role and specific permissions.

## Key Files

- **admin.module.ts** - Module definition importing InfraModule, AuthModule, and OutboxCoreModule
- **admin.controller.ts** - REST controller with role-based guards (`@Roles('admin')` + permission decorators)
- **admin.service.ts** - Service layer for admin operations including user status updates, company verification, and dead-letter replay
- **dto/** - Request/response DTOs for admin operations

## Subdirectories

- **dto/** - Data transfer objects for admin endpoints

## For AI Agents

### Working Instructions

1. **Authorization Model**: All admin routes require:
   - `@UseGuards(AuthGuard, RolesGuard)` at controller level
   - `@Roles('admin')` at controller level
   - `@Permissions(...)` at method level for granular access control
   - Available permissions: `MANAGE_USERS`, `MANAGE_COMPANIES`, `MANAGE_JOBS`, `MANAGE_ADMINS`

2. **Audit Logging**: Every admin action MUST create an audit log entry with:
   - `actorUserId`: the admin performing the action
   - `action`: descriptive action name (e.g., `admin.user.status_change`)
   - `entityType` and `entityId`: the affected entity
   - `metadata`: relevant context (reason, notes, etc.)

3. **User Management**:
   - List users with optional status filter and search (email/displayName)
   - Update user status (ACTIVE, SUSPENDED, etc.)
   - When suspending users, revoke all refresh tokens in the same transaction

4. **Company Management**:
   - List companies with optional search
   - Verify companies via `CompanyVerification` upsert + `Company.verified` sync
   - Keep `CompanyVerification` and `Company.verified/verifiedAt` in sync

5. **Dead-Letter Queue**:
   - List dead-letter events with optional eventType filter and cursor pagination
   - Replay dead-letter events via `DeadLetterService.replay()`
   - Always audit-log replay operations

### Testing Requirements

- Mock `PrismaService` for all database operations
- Mock `DeadLetterService` for outbox replay operations
- Test permission guards (verify 403 when permission missing)
- Test role guards (verify 403 when not admin)
- Test audit log creation for all mutating operations
- Test token revocation when suspending users
- Test company verification sync (both CompanyVerification and Company records)

### Common Patterns

- **Pagination**: Use cursor-based pagination with `take: 51` pattern (return 50, check hasMore)
- **Search**: Use `contains` with `mode: 'insensitive'` for case-insensitive search
- **Transactions**: Wrap multi-table updates in `prisma.$transaction()`
- **Idempotency**: Company verification uses upsert to handle repeated verification requests

## Dependencies

### Internal (Allowed by eslint.config.mjs)

- **auth** - AuthGuard, role/permission decorators
- **outbox** - DeadLetterService for replaying failed events

### External

- **@nestjs/common** - Controller, service, guards, decorators
- **@prisma/client** - UserStatus enum, Prisma types
- **infra** - PrismaService for database access

## Notes

- Admin routes are prefixed with `/admin` except for dead-letter operations
- All list operations return `{ data, meta }` structure with pagination metadata
- User status changes that result in SUSPENDED status automatically revoke all active refresh tokens
- Company verification creates/updates both `CompanyVerification` and `Company` records atomically
