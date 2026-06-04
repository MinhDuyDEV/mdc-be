<!-- Parent: ../AGENTS.md -->

# Recruiting Module

## Purpose

The Recruiting module provides talent acquisition tools for companies. It manages saved candidates, talent pools, and recruiter seat allocation. All operations are company-scoped with role-based access control (OWNER/ADMIN or active recruiter seat). The module enforces billing entitlements to ensure recruiter seats are only used when available in the company's plan.

## Key Files

- **recruiting.module.ts** - Module definition importing InfraModule, OutboxCoreModule, ConnectionsModule, and BillingModule
- **recruiting.controller.ts** - REST API endpoints for saved candidates and talent pools
- **recruiting.service.ts** - Core business logic with company-scoped authorization
- **recruiting-policy.service.ts** - Authorization policies for recruiting operations

## Subdirectories

### dto/
- `save-candidate.dto.ts` - SaveCandidateDto and AddCandidateToPoolDto
- `talent-pool.dto.ts` - CreateTalentPoolDto and UpdateTalentPoolDto
- `candidate-note.dto.ts` - Notes on saved candidates

## For AI Agents

### Working with Recruiting

1. **Authorization Pattern**:
   - All endpoints require company-scoped authorization via `assertEmployerRole(companyId, userId)`
   - Authorized roles: OWNER, ADMIN, or active RecruiterSeat member
   - Recruiter seats must be within billing entitlement limits
   - Throws `ForbiddenException` with error codes:
     - `COMPANY_NOT_FOUND` - Company doesn't exist or is deleted
     - `INSUFFICIENT_COMPANY_ROLE` - User lacks required role/seat
     - `ENTITLEMENT_EXCEEDED` - Recruiter seat limit reached

2. **Saved Candidates**:
   - **Save Candidate**: `saveCandidate(userId, companyId, dto)`
     - Verify candidate has `profile.recruitingEligible = true`
     - Idempotency key: `${companyId}:${candidateUserId}`
     - Create SavedCandidate record with savedByUserId, sourceId, note
     - Create audit log entry: `recruiting.candidate.save`
     - Emit CandidateSaved event
   - **Unsave Candidate**: Soft delete (set deletedAt)
   - **List Saved Candidates**: Cursor pagination with createdAt + id

3. **Talent Pools**:
   - **Create Pool**: `createTalentPool(userId, companyId, dto)`
     - Unique constraint on (companyId, name)
     - Throws `ConflictException` with `TALENT_POOL_NAME_TAKEN` on duplicate
   - **List Pools**: All non-deleted pools for company, ordered by createdAt desc
   - **Update Pool**: Name and/or description, enforces unique constraint
   - **Delete Pool**: Soft delete (set deletedAt)

4. **Talent Pool Candidates**:
   - **Add Candidate**: `addCandidateToPool(userId, companyId, poolId, dto)`
     - Verify pool exists and belongs to company
     - Idempotency key: `${poolId}:${candidateUserId}`
     - Create TalentPoolCandidate with addedByUserId
     - Create audit log: `recruiting.pool.add`
     - Emit CandidateAddedToTalentPool event
   - **Remove Candidate**: Soft delete from pool

5. **Recruiting Eligibility**:
   - Only candidates with `profile.recruitingEligible = true` can be saved
   - Throws `ForbiddenException` with `CANDIDATE_NOT_OPTED_IN_TO_RECRUITING` if false
   - Candidates control this flag in their profile settings

### Cursor Pagination

- **Pattern**: `{ createdAt, id }` encoded in base64
- **Query**: `cursor` and `limit` parameters
- **Response**: `{ data, meta: { nextCursor, hasMore } }`
- **Implementation**: Fetch `limit + 1` rows, detect hasMore, slice to limit

### Testing Requirements

- Test authorization for OWNER, ADMIN, and recruiter seat holders
- Test recruiter seat entitlement enforcement
- Test candidate recruiting eligibility check
- Test idempotency for save candidate and add to pool
- Test unique constraint on talent pool names (per company)
- Test soft delete behavior for candidates and pools
- Test cursor pagination (first page, subsequent pages, last page)
- Test audit log creation for save and pool operations
- Test event emission (CandidateSaved, CandidateAddedToTalentPool)

### Common Patterns

- **Company-Scoped Authorization**: Every operation verifies company access first
- **Recruiter Seat Enforcement**: Check billing entitlements before allowing operations
- **Idempotency**: Use IdempotencyService for save and add operations
- **Soft Deletes**: Set deletedAt instead of hard deletes
- **Audit Logging**: Record actor, action, entity for compliance
- **Event Emission**: Emit domain events via OutboxService

### Error Handling

- `NotFoundException`: Company, pool, or candidate not found
- `ForbiddenException`: Authorization failures (role, seat, eligibility)
- `ConflictException`: Duplicate pool name (P2002)

## Dependencies

### Internal
- `../infra` - PrismaService for database access
- `../outbox` - OutboxService for event emission, IdempotencyService for deduplication
- `../billing` - EntitlementsService for recruiter seat limit checks
- `../connections` - (indirect) Connection verification for candidate visibility

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `@prisma/client` - Prisma types

### Database Tables
- `companies` - Company records with deletedAt
- `company_members` - Company membership with role (OWNER, ADMIN, MEMBER)
- `recruiter_seats` - Allocated recruiter seats with status
- `saved_candidates` - Saved candidates with sourceId, note, deletedAt
- `talent_pools` - Named talent pools per company with deletedAt
- `talent_pool_candidates` - Many-to-many link with addedByUserId, deletedAt
- `profiles` - Candidate profiles with recruitingEligible flag
- `audit_logs` - Audit trail for recruiting operations
