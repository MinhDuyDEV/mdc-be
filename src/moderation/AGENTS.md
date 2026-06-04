<!-- Parent: ../AGENTS.md -->

# Moderation Module

## Purpose

The Moderation module handles content reporting, moderation workflows, and enforcement actions. It implements a claim-based workflow where moderators claim pending reports, review them, and apply actions (remove content, suspend users, warn, or dismiss). All actions are audited and emit outbox events.

**Key responsibilities:**
- Accept and track user-submitted reports (spam, harassment, inappropriate content)
- Implement claim-based moderation workflow with SKIP LOCKED for concurrency
- Apply moderation actions (REMOVE_CONTENT, SUSPEND_USER, BAN_USER, WARN, DISMISS)
- Enforce content removal across multiple entity types (POST, COMMENT, JOB)
- Suspend users and revoke their refresh tokens
- Audit all moderation actions for compliance

## Key Files

### Core Services

- **moderation.service.ts** - Main service for reporting and moderation actions
  - `createReport()` - Creates report with duplicate detection and priority assignment
  - `claimReport()` - Atomically claims PENDING report using SKIP LOCKED
  - `listReports()` - Lists reports filtered by status, ordered by priority
  - `applyModerationAction()` - Applies action and updates report status
  - `applyContentRemoval()` - Hides/removes content based on entity type
  - `applyUserSuspension()` - Suspends user and revokes all refresh tokens
  - `resolveTargetUser()` - Resolves user ID from reported entity

- **moderation-policy.service.ts** - Policy enforcement for moderation operations
  - `validateTargetExists()` - Verifies reported entity exists before creating report

### Controllers

- **moderation.controller.ts** - REST API for moderation (admin/moderator only)
  - `POST /moderation/reports` - Create report (rate-limited: 5/10min)
  - `GET /moderation/reports` - List reports (requires MODERATE_CONTENT permission)
  - `PATCH /moderation/reports/:id/claim` - Claim report (requires MODERATE_CONTENT)
  - `POST /moderation/actions` - Apply moderation action (requires MODERATE_CONTENT)

### Configuration

- **moderation.module.ts** - Module definition
  - Imports: InfraModule, OutboxCoreModule
  - Exports: ModerationService

## Subdirectories

### dto/

Input validation and response DTOs:
- **create-report.dto.ts** - Report creation request (targetEntity, targetId, category, description)
- **moderation-action.dto.ts** - Moderation action request (reportId, actionType, targetEntity, targetId, reason, durationHours)
- **report-response.dto.ts** - Report response format
- **index.ts** - Barrel export

## For AI Agents

### Working with Moderation

**Report creation flow:**
1. User calls `POST /moderation/reports` with target entity and category
2. Service validates target entity exists via ModerationPolicyService
3. Service checks for duplicate pending/under-review reports
4. Transaction: create report → create audit log → emit ReportCreated event
5. Priority assigned: SPAM = 2, others = 1

**Claim workflow:**
1. Moderator calls `PATCH /moderation/reports/:id/claim`
2. Service uses `SELECT ... FOR UPDATE SKIP LOCKED` to atomically claim
3. Report status changes from PENDING to UNDER_REVIEW
4. assignedToId set to moderator's user ID
5. Returns ConflictException if already claimed

**Action application flow:**
1. Moderator calls `POST /moderation/actions` with action type
2. Service validates report exists and matches target
3. Transaction: create moderation action → apply side-effects → update report status → audit log
4. Side-effects depend on action type (see below)

**Action types and side-effects:**
- **REMOVE_CONTENT**: Sets contentStatus to REMOVED_BY_MODERATOR or HIDDEN
- **SUSPEND_USER**: Sets user status to SUSPENDED, revokes all refresh tokens
- **BAN_USER**: Same as SUSPEND_USER (permanent suspension)
- **WARN**: No side-effects, just records warning
- **DISMISS**: No side-effects, marks report as RESOLVED_DISMISSED

### Testing Requirements

**Unit tests must cover:**
- Report creation with valid/invalid target entities
- Duplicate report detection (same user, same target, pending/under-review)
- Priority assignment (SPAM = 2, others = 1)
- Claim concurrency (SKIP LOCKED behavior)
- Action application for each action type
- Content removal for each entity type (POST, COMMENT, JOB)
- User suspension and token revocation
- Target user resolution from different entity types

**Integration tests must verify:**
- Full moderation flow (report → claim → action)
- Outbox event emission (ReportCreated)
- Concurrent claim attempts (only one succeeds)
- Audit log creation for all actions
- Content status updates across entity types
- User suspension side-effects (status + token revocation)

### Common Patterns

**Atomic claim with SKIP LOCKED:**
```typescript
await this.prisma.$transaction(async (tx) => {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM reports
    WHERE id = ${reportId}::uuid AND status = 'PENDING'
    FOR UPDATE SKIP LOCKED LIMIT 1
  `;
  if (!locked || locked.length === 0) {
    throw new ConflictException('Report already claimed or not found');
  }
  return tx.report.update({
    where: { id: reportId },
    data: { status: 'UNDER_REVIEW', assignedToId: moderatorId },
  });
});
```

### Report Categories

From Prisma schema (ReportCategory enum):
- **SPAM** - Spam or misleading content (priority 2)
- **HARASSMENT** - Harassment or bullying (priority 1)
- **INAPPROPRIATE** - Inappropriate or offensive content (priority 1)
- **HATE_SPEECH** - Hate speech or discrimination (priority 1)
- **VIOLENCE** - Violence or threats (priority 1)
- **OTHER** - Other violations (priority 1)

### Report Status Flow

- **PENDING** → **UNDER_REVIEW** (via claim)
- **UNDER_REVIEW** → **RESOLVED_ACTIONED** (via action: REMOVE_CONTENT, SUSPEND_USER, BAN_USER, WARN)
- **UNDER_REVIEW** → **RESOLVED_DISMISSED** (via action: DISMISS)

## Dependencies

### Internal Modules
- **infra/prisma** - Database access (Report, ModerationAction, AuditLog)
- **outbox** - Event emission (ReportCreated)
- **auth** - Authentication and authorization (AuthGuard, RolesGuard)
- **common/decorators** - Role and permission decorators

### External Dependencies
- **@nestjs/common** - NestJS framework
- **@nestjs/throttler** - Rate limiting (5 reports per 10 minutes)
- **@prisma/client** - Database client (ReportStatus, PostStatus, UserStatus enums)

### Database Schema
- **reports** - Stores user reports (targetEntity, targetId, category, status, priority, assignedToId)
- **moderation_actions** - Records moderation actions (reportId, moderatorId, actionType, reason, expiresAt)
- **audit_logs** - Audit trail for all moderation operations
- **posts, comments, jobs** - Content entities with contentStatus field
- **users** - User status field for suspensions
- **refresh_tokens** - Revoked during user suspension

### Outbox Events Emitted
- **ReportCreated** - After report creation (payload: reportId, targetEntity, targetId)

### Outbox Events Consumed
- None (moderation is a leaf domain in the event flow)
