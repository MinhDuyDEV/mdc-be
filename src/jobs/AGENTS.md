<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# jobs/

## Purpose

Job posting management module handling job creation, updates, search, and application tracking. Provides endpoints for employers to post jobs and job seekers to discover opportunities.

## Key Files

| File | Description |
|------|-------------|
| `jobs.module.ts` | NestJS module configuration with JobsController and JobsService |
| `jobs.controller.ts` | HTTP endpoints for job CRUD operations and search |
| `jobs.controller.spec.ts` | Unit tests for JobsController |
| `jobs.service.ts` | Business logic for job management and search |
| `jobs.service.spec.ts` | Unit tests for JobsService |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for job request/response payloads |

## For AI Agents

### Working In This Directory

- **Authorization** — Only company admins can create/edit jobs for their company
- **Search integration** — Index jobs in Elasticsearch for full-text search
- **Status management** — Jobs can be draft, published, closed, or archived
- **Application tracking** — Link to applications module for applicant management
- **Expiration** — Support job expiration dates and automatic status updates
- **Rich content** — Support markdown formatting for job descriptions

### Testing Requirements

```bash
# Unit tests
npm test -- jobs.service.spec.ts

# E2E tests
npm run test:e2e -- jobs.e2e-spec.ts
```

### Common Patterns

**Job Creation with Authorization:**
```typescript
@Post()
@UseGuards(AuthGuard, CompanyAdminGuard)
async createJob(
  @CurrentUser() user: User,
  @Body() dto: CreateJobDto,
) {
  // Verify user is admin of the company
  await this.companiesService.verifyAdmin(user.id, dto.companyId);
  
  const job = await this.jobsService.create(dto);
  
  // Index in Elasticsearch
  await this.searchIndexService.indexJob(job);
  
  return { data: job };
}
```

**Job Search:**
```typescript
@Get('search')
async searchJobs(@Query() dto: SearchJobsDto) {
  const results = await this.searchService.searchJobs({
    query: dto.q,
    location: dto.location,
    jobType: dto.jobType,
    limit: dto.limit,
    offset: dto.offset,
  });
  return { data: results.hits, meta: { total: results.total } };
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and authorization
- `src/companies/` — Company information and admin verification
- `src/applications/` — Application tracking
- `src/search/` — Elasticsearch integration for job search
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
