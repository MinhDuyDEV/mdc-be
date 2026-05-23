<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# recruiting/

## Purpose

Recruiting tools module providing advanced features for recruiters and hiring managers. Includes candidate search, applicant tracking, interview scheduling, and hiring pipeline management.

## Key Files

| File | Description |
|------|-------------|
| `recruiting.module.ts` | NestJS module configuration with RecruitingController, RecruitingService, and RecruitingPolicyService |
| `recruiting.controller.ts` | HTTP endpoints for recruiter operations |
| `recruiting.controller.spec.ts` | Unit tests for RecruitingController |
| `recruiting.service.ts` | Business logic for recruiting workflows |
| `recruiting.service.spec.ts` | Unit tests for RecruitingService |
| `recruiting-policy.service.ts` | Authorization policies for recruiting operations |
| `recruiting-policy.service.spec.ts` | Unit tests for policy service |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for recruiting request/response payloads |

## For AI Agents

### Working In This Directory

- **Authorization** — Only recruiters and hiring managers can access recruiting tools
- **Candidate search** — Advanced search with filters (skills, experience, location, etc.)
- **Pipeline management** — Track candidates through hiring stages
- **Interview scheduling** — Coordinate interviews between candidates and interviewers
- **Collaboration** — Allow team members to share notes and feedback on candidates
- **Compliance** — Ensure GDPR/privacy compliance for candidate data

### Testing Requirements

```bash
# Unit tests
npm test -- recruiting.service.spec.ts
npm test -- recruiting-policy.service.spec.ts

# E2E tests
npm run test:e2e -- recruiting.e2e-spec.ts
```

### Common Patterns

**Candidate Search:**
```typescript
@Get('candidates/search')
@UseGuards(AuthGuard, RecruiterGuard)
async searchCandidates(
  @CurrentUser() user: User,
  @Query() dto: SearchCandidatesDto,
) {
  const results = await this.recruitingService.searchCandidates({
    skills: dto.skills,
    experience: dto.experience,
    location: dto.location,
    limit: dto.limit,
    offset: dto.offset,
  });
  return { data: results.hits, meta: { total: results.total } };
}
```

**Pipeline Stage Update:**
```typescript
@Patch('applications/:id/stage')
@UseGuards(AuthGuard, RecruiterGuard)
async updateStage(
  @CurrentUser() user: User,
  @Param('id') applicationId: string,
  @Body() dto: UpdateStageDto,
) {
  await this.recruitingPolicyService.canManageApplication(user.id, applicationId);
  
  const application = await this.recruitingService.updateStage(
    applicationId,
    dto.stage,
  );
  
  // Notify candidate
  await this.notificationsService.create({
    userId: application.applicantId,
    type: 'APPLICATION_STAGE_UPDATED',
    metadata: { applicationId, stage: dto.stage },
  });
  
  return { data: application };
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and authorization
- `src/applications/` — Application data and status
- `src/jobs/` — Job posting information
- `src/users/` — Candidate profiles
- `src/search/` — Candidate search functionality
- `src/notifications/` — Candidate notifications
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
