<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# companies

## Purpose
Company management module providing company profiles, membership management, invitations, follower tracking, and recruiter seat allocation. Implements role-based access control (OWNER, ADMIN, MEMBER) with privilege escalation protection and last-owner safeguards.

## Key Files
| File | Description |
|------|-------------|
| `companies.module.ts` | Module configuration importing InfraModule and OutboxModule |
| `companies.controller.ts` | REST endpoints for company CRUD, members, invitations, followers, recruiter seats |
| `companies.service.ts` | Service methods for company operations with RBAC enforcement |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for company endpoints (see `dto/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Only verified users (emailVerifiedAt != null) can create companies
- Company creation is idempotent per (userId, name) tuple using IdempotencyService
- Company slugs are auto-generated from names and guaranteed unique via retry loop on P2002 conflicts
- Role hierarchy: OWNER (level 3) > ADMIN (level 2) > MEMBER (level 1)
- Privilege caps: actors cannot grant roles higher than their own, cannot modify members with higher roles
- Last-owner protection: cannot demote or remove the last OWNER
- Member invitations require email verification and email matching for acceptance
- Recruiter seat allocation uses atomic updateMany to prevent TOCTOU races
- All company operations emit outbox events for search indexing and audit trails

### Testing Requirements
- Test company creation requires verified email
- Test company creation idempotency (duplicate name for same user)
- Test slug uniqueness and collision handling
- Test RBAC: ADMIN cannot grant OWNER role, ADMIN cannot modify OWNER members
- Test last-owner protection: cannot demote or remove last OWNER
- Test invitation acceptance requires matching email and verified account
- Test recruiter seat allocation race conditions (concurrent claims)
- Verify outbox events are emitted for all company operations

### Common Patterns
- Use transactions for all company operations to ensure atomicity
- Slug generation uses slugify + unique constraint retry loop to handle concurrent creates
- RBAC helpers: hasRoleAtLeast, assertCanGrantRole, assertCanModifyTarget
- Idempotency: follow/unfollow, invitation acceptance are idempotent
- Cursor pagination for list endpoints (companies, members) with limit+1 fetch to detect hasMore
- Audit logs are created for company creation, member add/remove/role changes

## Dependencies

### Internal
- `../infra/prisma` - Database access for companies, members, invitations, followers, recruiter seats, audit logs
- `../outbox` - Event emission for CompanyCreated, CompanyUpdated, CompanyFollowed, MemberJoined, etc.
- `../common/auth` - CurrentUser decorator and AuthenticatedUser interface

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `@prisma/client` - Prisma types for CompanyRole enum
- `crypto` - randomUUID for invitation tokens
