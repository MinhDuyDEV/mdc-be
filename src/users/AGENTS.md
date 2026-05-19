<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# users

## Purpose
User profile management module providing endpoints for authenticated users to view and update their own profile, and to view public profiles of other users. Handles basic user information like display name, email, and account status.

## Key Files
| File | Description |
|------|-------------|
| `users.module.ts` | Module configuration importing InfraModule |
| `users.controller.ts` | REST endpoints for GET /users/me, PATCH /users/me, GET /users/:id |
| `users.service.ts` | Service methods for retrieving and updating user profiles |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for user endpoints (see `dto/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- The `/users/me` endpoint returns the authenticated user's own profile with sensitive fields (email, emailVerifiedAt)
- The `/users/:id` endpoint returns public profiles only (no email, filtered by status)
- Users with status DELETED or DISABLED are treated as not found in public profile queries
- Profile updates are limited to displayName; other fields require separate flows (email change, password change)

### Testing Requirements
- Test GET /users/me returns authenticated user's full profile
- Test PATCH /users/me updates displayName successfully
- Test GET /users/:id returns public profile without email
- Test GET /users/:id returns 404 for DELETED or DISABLED users
- Verify authentication is required for all endpoints

### Common Patterns
- All endpoints require authentication (no @Public() decorator)
- Use `@CurrentUser()` decorator to inject authenticated user context
- Public profiles filter out sensitive information and respect user status
- Service methods throw NotFoundException when user is not found or inaccessible

## Dependencies

### Internal
- `../infra/prisma` - Database access for user records
- `../common/auth` - CurrentUser decorator and AuthenticatedUser interface

### External
- `@nestjs/common` - NestJS core decorators and exceptions
