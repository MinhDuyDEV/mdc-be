<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Jobs DTOs

## Purpose
Data transfer objects for job posting management including creation, updates, listing, and search operations.

## Key Files
| File | Description |
|------|-------------|
| create-job.dto.ts | Validates job creation (title, description, requirements, salary range, location) |
| update-job.dto.ts | Validates job updates with partial field support |
| list-jobs.query.dto.ts | Query parameters for job listing with filters, pagination, and sorting |
| job.response.dto.ts | Response structure for job data with company details and application stats |

## For AI Agents

### Working In This Directory
- Job DTOs validate required fields (title, description, location, employment type)
- Salary range validation ensures min <= max and both are positive integers
- Location supports remote, hybrid, and on-site with optional city/country
- Skills and requirements are arrays of strings with max length constraints
- Response DTOs include application count and user's application status

### Testing Requirements
- Test job creation with all required fields
- Test salary range validation (min > max, negative values)
- Test location validation (remote vs on-site requirements)
- Test skills array validation (empty, max length, duplicates)
- Verify response DTO includes nested company data
- Run tests: `npm test -- src/jobs`

### Common Patterns
- Title validation: `@IsString() @MinLength(10) @MaxLength(200) title: string`
- Salary range: `@IsInt() @Min(0) salaryMin?: number; @IsInt() @Min(0) salaryMax?: number`
- Location: `@IsEnum(LocationType) locationType: LocationType; @IsOptional() @IsString() city?: string`
- Skills: `@IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) skills: string[]`

## Dependencies

### Internal
- Used by `JobsController` for request/response validation
- Used by `JobsService` for business logic
- References `EmploymentType`, `LocationType` enums from `@prisma/client`
- Integrates with search service for job discovery

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
