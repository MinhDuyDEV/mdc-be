<!-- Parent: ../AGENTS.md -->

# Companies Domain

## Purpose

The Companies domain manages company profiles, membership, invitations, and recruiter seat allocation. It implements role-based access control (OWNER, ADMIN, BILLING_ADMIN, MEMBER), privilege-capped operations (actors cannot grant roles higher than their own), and last-owner protection (cannot remove/demote the last OWNER).

## Key Files

- **companies.service.ts**: Core business logic for company CRUD, membership management, invitations, recruiter seat allocation, and company following. Implements privilege caps, last-owner protection, and slug uniqueness with retry.
- **companies.controller.ts**: REST endpoints for company operations. Uses `CompanyRoleGuard` for role-based authorization on member management routes.
- **companies.module.ts**: Module definition. Exports `CompaniesService` for use by other domains.

## Subdirectories

- **dto/**: Request/response DTOs
  - `create-company.dto.ts`: Company creation payload
  - `update-company.dto.ts`: Company update payload
  - `add-member.dto.ts`: Direct member addition (bypasses invitation)
  - `invite-member.dto.ts`: Member invitation payload
  - `accept-invitation.dto.ts`: Invitation acceptance payload
  - `update-member-role.dto.ts`: Role change payload
  - `allocate-recruiter-seat.dto.ts`: Recruiter seat allocation payload
  - `list-companies.dto.ts`: Company listing query params
  - `company-response.dto.ts`: Company response shape

## For AI Agents

### Working Instructions

1. **Only verified users can create companies**: Check `user.emailVerifiedAt` before allowing company creation.
2. **Slug uniqueness with retry**: Company slugs are auto-generated from names. If a slug collision occurs (P2002), retry with numeric suffix (up to 10 attempts).
3. **Privilege caps**: An actor cannot grant a role higher than their own, and cannot modify a member whose role is higher than their own. Use `assertCanGrantRole` and `assertCanModifyTarget` helpers.
4. **Last-owner protection**: Cannot demote or remove the last OWNER. Check `ownerCount` before allowing role changes or removals.
5. **Invitation flow**: Invitations expire after 7 days. Accepting user must match invitation email and have verified email. Idempotent: if user is already a member, mark invitation accepted and return existing membership.
6. **Recruiter seat allocation**: Seats are consumed from `CompanyEntitlement` credits. Allocation is atomic (claim seat + consume credit in same transaction). Use `updateMany` with status filter to prevent TOCTOU races.
7. **Company following**: Idempotent (already-following is no-op). Emits `CompanyFollowed`/`CompanyUnfollowed` events.

### Testing Requirements

- Test privilege caps: ADMIN cannot grant OWNER role, ADMIN cannot modify OWNER members
- Test last-owner protection: cannot remove or demote the last OWNER
- Test slug collision handling: verify numeric suffix retry logic
- Test invitation expiry: expired invitations cannot be accepted
- Test invitation email binding: only the invited user can accept
- Test recruiter seat TOCTOU: concurrent allocations should not exceed available seats
- Test idempotency: duplicate company creation (same user + name), duplicate follows

### Common Patterns

- **Slug generation**: Use `slugify()` to normalize names, `withUniqueCompanySlug()` to retry on P2002 conflicts
- **Role hierarchy**: `ROLE_LEVEL` map defines privilege ordering (OWNER=3, ADMIN=2, MEMBER=1)
- **Relationship counts**: Use `withCompanyRelationshipCounts()` to transform `_count` into `followerCount`/`memberCount`
- **Audit logging**: All mutating operations create `AuditLog` entries with actor, action, and metadata
- **Outbox pattern**: Company lifecycle events are emitted via `OutboxService`

## Dependencies

### Internal (Domain Imports)

- **billing**: `EntitlementsService` for recruiter seat credit consumption
- **outbox**: Event emission for company lifecycle events

### External (Infrastructure)

- **infra/prisma**: Database access via `PrismaService`
- **common/auth**: `CurrentUser` decorator, `AuthenticatedUser` interface
- **common/guards**: `CompanyRoleGuard` for role-based authorization
- **common/decorators**: `CompanyRole` decorator for role requirements
- **common/idempotency**: `IdempotencyKeyInterceptor`, `IdempotentRequest` decorator
- **@prisma/client**: `CompanyRole` enum, `Prisma` types

### Allowed Imports (per eslint.config.mjs)

This domain can import from: `companies` (self), `billing`, `outbox`

## Database Schema

- **Company**: Company profiles with slug, industry, description, website, employee count, founded year, headquarters
- **CompanyMember**: Membership records with role (OWNER, ADMIN, BILLING_ADMIN, MEMBER) and status (active, inactive)
- **CompanyFollower**: Follow relationships (users following companies)
- **MemberInvitation**: Pending invitations with token, email, role, expiry
- **RecruiterSeat**: Allocated recruiter seats with status (available, allocated)

## Events Emitted

- `CompanyCreated`: When a company is created
- `CompanyUpdated`: When company details are updated
- `CompanyFollowed`: When a user follows a company
- `CompanyUnfollowed`: When a user unfollows a company
- `MemberInvited`: When a member invitation is sent
- `MemberJoined`: When an invitation is accepted
- `CompanyMemberAdded`: When a member is added directly (bypassing invitation)
- `CompanyMemberRoleChanged`: When a member's role is updated
- `CompanyMemberRemoved`: When a member is removed
- `RecruiterSeatAllocated`: When a recruiter seat is allocated
- `RecruiterSeatDeallocated`: When a recruiter seat is deallocated
