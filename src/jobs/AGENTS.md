<!-- Parent: ../AGENTS.md -->

# Jobs Domain

## Purpose

The Jobs domain manages job postings, job lifecycle (draft → published → closed → deleted), job search with full-text search, and saved jobs. It implements role-based authorization (company OWNER/ADMIN or allocated RecruiterSeat), credit-based publishing (consumes `job_posts` entitlement), and apply mode validation (INTERNAL, EXTERNAL, HYBRID).

## Key Files

- **jobs.service.ts**: Core business logic for job CRUD, publishing, closing, deletion, saved jobs, and external apply tracking. Implements authorization checks, apply mode validation, and full-text search with cursor pagination.
- **jobs.controller.ts**: REST endpoints for job operations. Uses `EmailVerifiedGuard` for email verification gate. Authorization is enforced in service layer (not via `CompanyRoleGuard` because `:id` is jobId, not companyId).
- **jobs.module.ts**: Module definition. Imports `BillingModule` for entitlement checks.

## Subdirectories

- **dto/**: Request/response DTOs
  - `create-job.dto.ts`: Job creation payload
  - `update-job.dto.ts`: Job update payload
  - `list-jobs.query.dto.ts`: Job listing query params (with FTS support)
  - `job.response.dto.ts`: Job response shape

## For AI Agents

### Working Instructions

1. **Authorization**: Only company OWNER/ADMIN or users with allocated RecruiterSeat can manage jobs. Use `assertCanManageJob()` to verify access.

2. **Apply mode validation**:
   - `INTERNAL`: `applyUrl` must be absent (applications via platform)
   - `EXTERNAL`: `applyUrl` must be present (applications via external URL)
   - `HYBRID`: `applyUrl` must be present (both internal and external applications)

3. **Job lifecycle**:
   - `DRAFT` → `PUBLISHED`: Consumes 1 `job_posts` credit from `CompanyEntitlement`. Credit check and status update happen in same transaction.
   - `PUBLISHED` → `CLOSED`: No credit refund. Job remains visible but no longer accepts applications.
   - Any status → `DELETED`: Soft delete (sets `deletedAt`). Job is hidden from all listings.

4. **Full-text search**: When `q` parameter is present, use PostgreSQL `ts_rank` with `search_vector` column. Cursor pagination uses `(rank DESC, publishedAt DESC NULLS LAST, id DESC)` keyset.

5. **Visibility rules**:
   - `PUBLISHED` jobs: visible to everyone
   - Non-published jobs: visible only to company members (OWNER/ADMIN or RecruiterSeat holders)

6. **Saved jobs**: Idempotent save/unsave operations. Saved jobs are soft-deleted (set `deletedAt`) on unsave.

7. **External apply tracking**: Emit `ExternalApplyClicked` event when user clicks external apply link (for analytics).

### Testing Requirements

- Test authorization: verify only OWNER/ADMIN/RecruiterSeat can manage jobs
- Test apply mode validation: verify INTERNAL rejects applyUrl, EXTERNAL/HYBRID require applyUrl
- Test publish credit consumption: verify credit is consumed atomically with status change
- Test publish credit exhaustion: verify publish fails when credits are exhausted
- Test visibility rules: verify non-published jobs are hidden from non-members
- Test FTS cursor pagination: verify rank-based keyset pagination correctness
- Test saved jobs idempotency: verify duplicate save/unsave operations
- Test lifecycle transitions: verify invalid transitions are rejected (e.g., CLOSED → PUBLISHED)

### Common Patterns

- **Authorization helper**: `assertCanManageJob()` loads job and verifies user is OWNER/ADMIN or has allocated RecruiterSeat
- **Apply mode validation**: `validateApplyMode()` enforces mutual exclusivity between applyMode and applyUrl
- **Cursor encoding**: Use `encodeCursor(createdAt, id)` for standard pagination, `encodeFtsCursor(rank, publishedAt, id)` for FTS pagination
- **Credit consumption**: Use `EntitlementsService.consumeCredit()` inside transaction to ensure atomicity
- **Audit logging**: All mutating operations create `AuditLog` entries
- **Outbox pattern**: Job lifecycle events are emitted via `OutboxService`

## Dependencies

### Internal (Domain Imports)

- **billing**: `EntitlementsService` for job post credit consumption
- **outbox**: Event emission for job lifecycle events

### External (Infrastructure)

- **infra/prisma**: Database access via `PrismaService`
- **common/auth**: `CurrentUser` decorator, `AuthenticatedUser` interface
- **common/guards**: `EmailVerifiedGuard` for email verification gate
- **common/pagination**: `CursorPaginationQueryDto` for pagination params
- **@prisma/client**: `ApplyMode`, `JobStatus` enums, `Prisma` types

### Allowed Imports (per eslint.config.mjs)

This domain can import from: `jobs` (self), `billing`, `outbox`

## Database Schema

- **Job**: Job postings with title, description, applyMode, applyUrl, employmentType, workplaceType, location, salary range, status, publishedAt, closedAt, deletedAt, search_vector (tsvector for FTS)
- **JobSkill**: Job-skill associations (many-to-many)
- **SavedJob**: User-saved jobs with soft delete (deletedAt)
- **CompanyMember**: For authorization checks
- **RecruiterSeat**: For authorization checks

## Events Emitted

- `JobCreated`: When a job is created
- `JobUpdated`: When job details are updated
- `JobPublished`: When a job is published (credit consumed)
- `JobClosed`: When a job is closed
- `JobDeleted`: When a job is deleted
- `ExternalApplyClicked`: When a user clicks external apply link

## Apply Modes

- **INTERNAL**: Applications via platform only (no external URL)
- **EXTERNAL**: Applications via external URL only (no internal applications)
- **HYBRID**: Both internal and external applications allowed

## Job Statuses

- **DRAFT**: Not visible to public, no credit consumed
- **PUBLISHED**: Visible to public, credit consumed
- **CLOSED**: No longer accepting applications, still visible
- **DELETED**: Soft deleted, hidden from all listings
