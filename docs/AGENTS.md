<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 | Updated: 2026-05-27 -->

# docs/

## Purpose

Project documentation including architecture decisions, operational runbooks, baseline metrics, frontend specifications, and development goals. This directory contains human-readable documentation for developers, operators, and stakeholders.

## Key Files

| File | Description |
|------|-------------|
| `architecture.md` | System architecture overview: outbox pattern, process roles, module responsibilities, and ADR references |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `baseline/` | Baseline metrics and verification snapshots captured before implementation phases |
| `decisions/` | Architecture Decision Records (ADRs) documenting Phase 0 decisions and rationale (see `decisions/README.md`) |
| `frontend/` | Frontend specifications, API contracts, page plans, and implementation guides (see `frontend/README.md`) |
| `goals/` | Phase-specific goals and completion tracking documents |
| `runbooks/` | Operational procedures for deployment, incidents, rollback, and maintenance (see `runbooks/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Keep docs in sync with code** — update architecture.md when making structural changes
- **Use markdown format** — all docs are markdown for git-friendly diffs
- **Add runbooks for new operations** — document deployment, rollback, and incident procedures
- **Link to code** — reference specific files and line numbers when documenting patterns
- **Version decisions** — add dates to architecture decisions for historical context
- **Update baselines** — capture metrics before major phases to track progress
- **Frontend specs are authoritative** — BACKEND_CONTRACT.md is the source of truth for API integration

### Testing Requirements

No automated tests. Verification is manual:

1. Read the documentation
2. Verify it matches current codebase state
3. Check for broken links or outdated references
4. Ensure code examples are accurate
5. For runbooks: test procedures in staging before production use

### Common Patterns

**Architecture Documentation:**
```markdown
## Pattern Name

### Components
- Component A: Responsibility
- Component B: Responsibility

### Flow
1. Step 1
2. Step 2
3. Step 3

### Example
\`\`\`typescript
// Code example
\`\`\`
```

**Runbook Structure:**
```markdown
# Operation Name

## Prerequisites
- Requirement 1
- Requirement 2

## Steps
1. Step 1
2. Step 2

## Verification
- Check 1
- Check 2

## Rollback
- Rollback step 1
- Rollback step 2
```

**ADR Structure:**
```markdown
# ADR-NNNN: Title

## Status
Accepted | Proposed | Deprecated

## Context
Problem statement and background

## Decision
What was decided and why

## Consequences
Positive and negative impacts
```

## Dependencies

### Internal

- `src/` — Code documented in architecture.md
- `prisma/` — Database schema referenced in architecture docs
- Root `AGENTS.md` references docs/ for architecture context

### External

None. Documentation is self-contained.

## Key Concepts

From `architecture.md`:

**Outbox Pattern:**
- Transactional event creation via OutboxService
- Polling with `SELECT FOR UPDATE SKIP LOCKED`
- Retry with exponential backoff
- Dead-letter queue for failed events

**Process Roles:**
- `api` — HTTP routes only
- `worker` — Background processing (outbox, scheduled jobs)
- `realtime` — WebSocket connections
- `all` — Everything (local dev)

Set via `APP_PROCESS_ROLE` environment variable.

**Frontend Integration:**
- REST base URL: `/api/v1`
- Auth: bearer access token in `Authorization: Bearer <token>`
- Refresh: HTTP-only `refreshToken` cookie
- Success response: `{ data, meta? }`
- Error response: `{ error: { code, message, details?, requestId? } }`

## Subdirectory Details

### baseline/

Captures system metrics before implementation phases begin. Used to track progress and verify improvements.

**Key files:**
- `2026-05-baseline.md` — Phase 0 baseline: test counts, ESLint warnings, TypeScript strict mode status, Docker image size

### decisions/

Architecture Decision Records documenting Phase 0 decisions. Each ADR includes context, decision rationale, and consequences.

**Key files:**
- `README.md` — Index of all ADRs
- `0001-refresh-token-shape.md` — JWT refresh token structure
- `0002-media-visibility-model.md` — Media access control model
- `0003-deploy-target.md` — Deployment infrastructure
- `0004-idempotency-key-rollout.md` — Idempotency key strategy
- `0005-counter-strategy.md` — Counter/metric aggregation
- `0006-cron-leader-election.md` — Distributed cron coordination
- `0007-schema-organization.md` — Database schema structure
- `0008-ci-e2e-infrastructure.md` — CI/CD and E2E testing setup

### frontend/

Frontend specifications and API contracts. Authoritative source for frontend integration with the backend.

**Key files:**
- `README.md` — Overview and file guide
- `BACKEND_CONTRACT.md` — Current backend API, auth, realtime, settings, data model, and operational constraints
- `PAGE_PLAN.md` — Page-by-page frontend plan based on backend contract
- `FRONTEND_IMPLEMENTATION_SPEC.md` — Frontend architecture, API client behavior, caching, realtime, upload, UX states
- `FRONTEND_COMPLETENESS_REVIEW.md` — Readiness audit and backend gaps blocking full integration
- `API_REFERENCE.md` — Quick API index
- `PERMISSIONS.md` — Auth, email verification, company roles, admin permissions, route gates
- `FRONTEND_PAGES_PLAN.md` — Detailed page implementation plan
- `IMAGE_GENERATION_PROMPTS.md` — Image generation specifications

### goals/

Phase-specific goals and completion tracking.

**Key files:**
- `complete-audit-optimization.md` — Phase 1 goals for audit and optimization work

### runbooks/

Operational procedures for deployment, incident response, and system maintenance.

**Key files:**
- `AGENTS.md` — Runbooks directory guide
- `deploy.md` — Deployment process and verification
- `rollback.md` — Rollback procedures and recovery
- `incident.md` — Incident response and triage
- `outbox-backlog.md` — Outbox recovery and performance tuning
- `outbox-replay.md` — Dead-letter event replay procedures

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
