<!-- Parent: ../AGENTS.md -->

# Applications Domain

## Purpose

Job application lifecycle management with state machine-driven status transitions. Handles application submission, status updates, notes, and resume access with dual-audience authorization (candidate vs employer).

## Key Files

- **applications.module.ts** - Module definition importing InfraModule, MediaModule, and OutboxCoreModule
- **applications.controller.ts** - REST controller with dual-audience routes (candidate and employer scopes)
- **applications.service.ts** - Service layer implementing authorization model and state machine transitions
- **application-status.machine.ts** - Pure state machine for application status transitions with actor-based rules
- **dto/** - Request/response DTOs for application operations

## Subdirectories

- **dto/** - Data transfer objects including `SubmitApplicationDto`, `UpdateApplicationStatusDto`, `CreateApplicationNoteDto`, and response mappers

## For AI Agents

### Working Instructions

1. **Authorization Model** (dual-audience):
   - **Candidate scope**: Routes operating on the caller's own application
   - **Employer scope**: Routes guarded by company role check (OWNER, ADMIN, or active RecruiterSeat)
   - Employer role resolved from `Job.companyId`, NOT from route params
   - DTO whitelisting: `toApplicationResponseDto()` takes `audience` flag to strip notes for candidates

2. **Application Submission**:
   - Verify job exists, is PUBLISHED, and has `applyMode !== 'EXTERNAL'`
   - Recruiters cannot apply to their own company
   - Resume validation: must belong to candidate, have `purpose='resume'`, and `status='READY'`
   - Idempotency: return existing active application if found
   - Create application + initial status event + audit log + outbox event in transaction

3. **State Machine** (`application-status.machine.ts`):
   - **Actors**: `candidate`, `recruiter`, `system`
   - **Terminal states**: ACCEPTED, REJECTED, WITHDRAWN (no transitions out)
   - **Transition rules**: Source terminal → error, Invalid target → error with allowed list, WITHDRAWN requires candidate, Others require recruiter
   - Use `evaluateTransition()` to validate before updating status

4. **Status Updates**:
   - Call `evaluateTransition()` to validate transition
   - Map decision reasons to HTTP errors
   - Create `ApplicationStatusEvent` record for audit trail
   - Emit `ApplicationStatusChanged` outbox event
   - Use idempotency key: `${applicationId}:${newStatus}`

5. **Notes** (employer-only):
   - Only employers can add/view notes
   - Notes are soft-deleted (`deletedAt` column)
   - Emit `ApplicationNoteAdded` outbox event

6. **Resume Access**:
   - Both candidate and employer can request resume access
   - Service returns `mediaAssetId` and `ownerUserId` for controller to delegate to MediaService
   - Audit-log every resume access with `audience` flag

7. **Pagination**:
   - Cursor-based pagination using `(submittedAt, id)` composite cursor
   - Encode cursor as base64 JSON
   - Order by `[{ submittedAt: 'desc' }, { id: 'desc' }]`

### Testing Requirements

- Mock `PrismaService`, `OutboxService`, `IdempotencyService`
- Test state machine transitions (all valid and invalid)
- Test actor-based authorization
- Test terminal state enforcement
- Test dual-audience response mapping
- Test recruiter-cannot-apply-to-own-company guard
- Test resume validation
- Test idempotency
- Test cursor pagination

### Common Patterns

- **Dual-Audience Loading**: `loadApplicationWithAudience()` returns `{ app, audience, isCandidate, companyId }`
- **Existence Oracle Prevention**: Return same 404 for not-found and unauthorized
- **Idempotent Returns**: Return existing entity if idempotency key matches
- **Composite Cursors**: Use `(timestamp, id)` for stable pagination
- **Outbox Events**: Emit domain events for all state changes

## Dependencies

### Internal (Allowed by eslint.config.mjs)

- **media** - MediaService for resume download URL generation
- **outbox** - OutboxService for event emission, IdempotencyService for duplicate prevention

### External

- **@nestjs/common** - Controller, service, guards, decorators
- **@prisma/client** - ApplicationStatus enum, JobStatus enum, Prisma types
- **infra** - PrismaService for database access

## Notes

- Application status follows a strict state machine with actor-based rules
- Employer role is resolved from `Job.companyId`, not from route params
- Notes are employer-only and never exposed to candidates
- Resume access is audit-logged for compliance
- Idempotency prevents duplicate applications
- Cursor pagination uses composite key `(submittedAt, id)`
- All state changes emit outbox events
