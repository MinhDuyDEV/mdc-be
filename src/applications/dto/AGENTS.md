<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Applications DTOs

## Purpose
Data transfer objects for job application workflows including submission, status updates, and application notes. Validates application data and state transitions.

## Key Files
| File | Description |
|------|-------------|
| submit-application.dto.ts | Validates job application submission (job ID, cover letter, resume) |
| update-status.dto.ts | Validates application status transitions with state machine rules |
| application-note.dto.ts | Validates internal notes added to applications by recruiters |
| application.response.dto.ts | Response structure for application data with nested relationships |

## For AI Agents

### Working In This Directory
- Application DTOs enforce state machine rules (see `application-status.machine.ts`)
- Status updates validate allowed transitions (e.g., PENDING → REVIEWING, not PENDING → HIRED)
- Notes require author context and are immutable once created
- Response DTOs include nested job, candidate, and company data
- Cover letters and resumes are validated for length and format

### Testing Requirements
- Test valid application submission with all required fields
- Test status transition validation (valid/invalid state changes)
- Test note creation with proper author attribution
- Verify response DTO serialization includes nested relationships
- Run tests: `npm test -- src/applications`

### Common Patterns
- Application submission: `@IsUUID() jobId: string; @IsString() @MaxLength(2000) coverLetter: string`
- Status updates: `@IsEnum(ApplicationStatus) status: ApplicationStatus; @IsString() reason?: string`
- Notes: `@IsString() @MinLength(1) @MaxLength(1000) content: string`
- Response nesting: `{ application: {...}, job: {...}, candidate: {...} }`

## Dependencies

### Internal
- Used by `ApplicationsController` for request/response validation
- Used by `ApplicationsService` for business logic
- References `ApplicationStatus` enum from `@prisma/client`
- Integrates with `application-status.machine.ts` for state validation

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
