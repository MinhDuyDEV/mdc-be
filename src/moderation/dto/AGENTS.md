<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Moderation DTOs

## Purpose
Data transfer objects for content moderation including report creation, moderation actions, and report management.

## Key Files
| File | Description |
|------|-------------|
| create-report.dto.ts | Validates content report creation (content type, content ID, reason, description) |
| moderation-action.dto.ts | Validates moderation actions (approve, remove, warn, ban) with reason |
| report-response.dto.ts | Response structure for report data with reporter, content, and status |
| index.ts | Barrel export for all moderation DTOs |

## For AI Agents

### Working In This Directory
- Report DTOs validate content type (post, comment, profile, job, message)
- Reason field uses predefined enum (spam, harassment, inappropriate, etc.)
- Moderation actions require admin/moderator role and audit trail
- Actions include severity levels (warning, content removal, user suspension, ban)
- Response DTOs include reporter anonymization for privacy

### Testing Requirements
- Test report creation with all content types
- Test reason validation (valid/invalid enum values)
- Test moderation action authorization (admin/moderator only)
- Verify audit trail fields (moderator ID, timestamp, reason)
- Test reporter anonymization in responses
- Run tests: `npm test -- src/moderation`

### Common Patterns
- Report creation: `@IsEnum(ContentType) contentType: ContentType; @IsUUID() contentId: string; @IsEnum(ReportReason) reason: ReportReason`
- Moderation action: `@IsEnum(ModerationAction) action: ModerationAction; @IsString() @MinLength(10) reason: string`
- Severity: `@IsEnum(Severity) severity: Severity` (LOW, MEDIUM, HIGH, CRITICAL)
- Audit trail: `{ moderatorId, action, reason, timestamp }`

## Dependencies

### Internal
- Used by `ModerationController` for request/response validation
- Used by `ModerationService` for business logic
- Integrates with `ModerationPolicyService` for authorization
- References content type enums from `@prisma/client`

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
