<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Recruiting DTOs

## Purpose
Data transfer objects for recruiting operations including candidate management, talent pools, and recruiter notes.

## Key Files
| File | Description |
|------|-------------|
| save-candidate.dto.ts | Validates saving candidates to talent pools (candidate ID, pool ID, notes) |
| talent-pool.dto.ts | Validates talent pool creation and management (name, description, filters) |
| candidate-note.dto.ts | Validates recruiter notes on candidates (content, visibility, tags) |

## For AI Agents

### Working In This Directory
- Candidate DTOs validate user IDs and talent pool associations
- Talent pool DTOs support dynamic filters (skills, location, experience)
- Notes are private to recruiters by default (visibility: PRIVATE, TEAM, COMPANY)
- Tags enable candidate organization (e.g., "top-candidate", "needs-follow-up")
- All operations require recruiter role and active recruiter seat

### Testing Requirements
- Test candidate save with valid/invalid pool IDs
- Test talent pool creation with filter validation
- Test note creation with visibility levels
- Test tag validation (max length, special characters)
- Verify recruiter authorization on all operations
- Run tests: `npm test -- src/recruiting`

### Common Patterns
- Save candidate: `@IsUUID() candidateId: string; @IsUUID() poolId: string; @IsOptional() @MaxLength(1000) notes?: string`
- Talent pool: `@IsString() @MinLength(3) @MaxLength(100) name: string; @IsObject() filters: TalentPoolFilters`
- Note visibility: `@IsEnum(NoteVisibility) visibility: NoteVisibility`
- Tags: `@IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) tags?: string[]`

## Dependencies

### Internal
- Used by `RecruitingController` for request/response validation
- Used by `RecruitingService` for business logic
- Integrates with `RecruitingPolicyService` for authorization
- References `../../billing/entitlements/` for recruiter seat validation

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
