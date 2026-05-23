<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# applications/

## Purpose

Job application management module handling the application lifecycle from submission to hiring decision. Implements state machine for application status transitions, tracks application history, and provides endpoints for applicants and recruiters.

## Key Files

| File | Description |
|------|-------------|
| `applications.module.ts` | NestJS module configuration with ApplicationsController and ApplicationsService |
| `applications.controller.ts` | HTTP endpoints for application submission, status updates, and queries |
| `applications.controller.spec.ts` | Unit tests for ApplicationsController |
| `applications.service.ts` | Business logic for application lifecycle management |
| `applications.service.spec.ts` | Unit tests for ApplicationsService |
| `application-status.machine.ts` | XState state machine defining valid application status transitions |
| `application-status.machine.spec.ts` | Unit tests for state machine transitions |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for application request/response payloads |

## For AI Agents

### Working In This Directory

- **State machine enforcement** — All status transitions must go through the state machine
- **Authorization** — Applicants can view their own applications; recruiters can view applications for their jobs
- **Notifications** — Trigger notifications on status changes (applied, reviewed, rejected, accepted)
- **Audit trail** — Log all status changes with timestamps and actor information
- **Duplicate prevention** — Prevent multiple applications to the same job by the same user

### Testing Requirements

```bash
# Unit tests
npm test -- applications.service.spec.ts
npm test -- application-status.machine.spec.ts

# E2E tests
npm run test:e2e -- applications.e2e-spec.ts
```

### Common Patterns

**State Machine Usage:**
```typescript
import { applicationStatusMachine } from './application-status.machine';

const currentState = application.status;
const event = 'REVIEW';
const nextState = applicationStatusMachine.transition(currentState, event);

if (nextState.changed) {
  await this.prisma.application.update({
    where: { id: applicationId },
    data: { status: nextState.value },
  });
}
```

**Authorization Check:**
```typescript
// Applicant can only view their own applications
if (application.applicantId !== currentUser.id && !currentUser.isRecruiter) {
  throw new ForbiddenException('Cannot access this application');
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and authorization
- `src/jobs/` — Job posting information
- `src/users/` — Applicant and recruiter profiles
- `src/notifications/` — Status change notifications
- `src/common/` — Response formatting, error handling, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `xstate` — State machine library (if used)
- `@prisma/client` — Database models

<!-- MANUAL: -->
