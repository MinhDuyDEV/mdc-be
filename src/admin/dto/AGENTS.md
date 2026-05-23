<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Admin DTOs

## Purpose
Data transfer objects for administrative operations including user management, content moderation, and system-wide actions. Validates admin-specific queries and action requests.

## Key Files
| File | Description |
|------|-------------|
| admin-action.dto.ts | DTOs for administrative actions (user suspension, content removal, etc.) |
| admin-query.dto.ts | Query parameters for admin list/search operations with pagination and filtering |
| index.ts | Barrel export for all admin DTOs |

## For AI Agents

### Working In This Directory
- Admin DTOs enforce strict validation for privileged operations
- Query DTOs support pagination, sorting, and filtering for admin dashboards
- Action DTOs require explicit confirmation fields for destructive operations
- All DTOs validate user IDs, content IDs, and reason fields for audit trails
- Use `class-validator` decorators for input validation

### Testing Requirements
- Test validation for all required fields
- Test pagination boundaries (page size limits, negative values)
- Test filter combinations (multiple filters, invalid filter values)
- Verify audit trail fields (reason, admin ID) are properly validated
- Run tests: `npm test -- src/admin`

### Common Patterns
- Pagination: `@IsOptional() @IsInt() @Min(1) page?: number`
- Filtering: `@IsOptional() @IsEnum(FilterType) filter?: FilterType`
- Audit fields: `@IsString() @MinLength(10) reason: string`
- Confirmation: `@IsBoolean() confirm: boolean` for destructive actions

## Dependencies

### Internal
- Used by `AdminController` for request validation
- Used by `AdminService` for business logic
- May reference enums from `@prisma/client` for status values

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
