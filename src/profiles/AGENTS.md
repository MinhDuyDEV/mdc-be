<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# profiles

## Purpose
Professional profile management module providing rich user profiles with skills, work experience, education, certifications, languages, and endorsements. Supports profile visibility controls, full-text search, and skill endorsements from other users.

## Key Files
| File | Description |
|------|-------------|
| `profiles.module.ts` | Module configuration importing InfraModule and OutboxModule |
| `profiles.controller.ts` | REST endpoints for profile CRUD, search, and endorsements |
| `profiles.service.ts` | Service methods for profile management with visibility filtering |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for profile endpoints (see `dto/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Profiles are auto-created on first access if they don't exist
- Profile updates use replace semantics for sub-entities (skills, experiences, educations, certifications, languages)
- Profile visibility controls what fields are returned: PUBLIC (all fields), CONNECTIONS_ONLY (limited fields), PRIVATE (minimal fields)
- Profile owners always see their full profile regardless of visibility setting
- Profile search uses Postgres full-text search on the `search_vector` column
- Skill endorsements prevent self-endorsement and enforce unique constraint per (skill, endorser)
- Experience validation ensures startDate < endDate and isCurrent=true implies endDate=null
- All profile updates emit ProfileUpdated outbox events

### Testing Requirements
- Test profile auto-creation on first GET /profiles/me
- Test profile update with nested sub-entities (skills, experiences, etc.)
- Test visibility filtering for PUBLIC, CONNECTIONS_ONLY, PRIVATE profiles
- Test profile search returns only PUBLIC profiles
- Test skill endorsement prevents self-endorsement
- Test skill endorsement idempotency (duplicate endorsement returns ConflictException)
- Test experience validation for date ranges and isCurrent flag
- Verify ProfileUpdated events are emitted on updates

### Common Patterns
- Use transactions for profile updates to ensure atomicity of profile + sub-entities + outbox event
- Replace semantics: updating skills deletes all existing skills and creates new ones
- Visibility filtering is applied in getPublicProfile based on ProfileVisibility enum
- Search uses Postgres websearch_to_tsquery for natural language queries
- Endorsements use composite unique constraint (profileSkillId, endorserId)

## Dependencies

### Internal
- `../infra/prisma` - Database access for profiles, skills, experiences, educations, certifications, languages, endorsements
- `../outbox` - Event emission for ProfileUpdated
- `../common/auth` - CurrentUser decorator and AuthenticatedUser interface

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `@prisma/client` - Prisma types for ProfileVisibility enum
