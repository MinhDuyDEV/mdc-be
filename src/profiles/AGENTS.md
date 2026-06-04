<!-- Parent: ../AGENTS.md -->

# Profiles Module

## Purpose

The Profiles module manages user professional profiles including headline, about, location, website, skills, work experiences, education, certifications, languages, and skill endorsements. Profiles support visibility controls (PUBLIC, CONNECTIONS_ONLY, PRIVATE) and full-text search via PostgreSQL tsvector. The module handles profile creation on-demand, transactional sub-entity replacement, and skill taxonomy normalization.

## Key Files

- **profiles.module.ts** - Module definition importing InfraModule and OutboxCoreModule
- **profiles.controller.ts** - REST API endpoints for profile CRUD, search, and endorsements
- **profiles.service.ts** - Core business logic with transactional sub-entity management

## Subdirectories

### dto/
- `update-profile.dto.ts` - Profile updates with optional sub-entity arrays
- `skill.dto.ts` - Skill with name, category, proficiency
- `experience.dto.ts` - Work experience with title, company, dates, isCurrent flag
- `education.dto.ts` - Education with school, degree, field of study, dates
- `certification.dto.ts` - Certification with issuer, dates, credential info
- `language.dto.ts` - Language with proficiency level
- `endorse-skill.dto.ts` - Skill endorsement request
- `profile-response.dto.ts` - Structured profile response
- `search-profiles.dto.ts` - Full-text search query parameters

## For AI Agents

### Working with Profiles

1. **Profile Creation**:
   - Profiles are created on-demand when first accessed via `getOwnProfile()`
   - If profile doesn't exist, create with default values (userId only)
   - Return profile with all sub-entities included

2. **Profile Updates**:
   - Use `updateOwnProfile()` with partial UpdateProfileDto
   - Top-level fields (headline, about, location, etc.) are merged
   - Sub-entity arrays (skills, experiences, etc.) use **replace semantics**:
     - If array is provided, delete all existing records and create new ones
     - If array is undefined, leave existing records unchanged
   - All operations wrapped in `prisma.$transaction()` with savepoints
   - Emit ProfileUpdated event after successful update

3. **Skill Management**:
   - Skills are normalized: `name.trim().toLowerCase()` for taxonomy consistency
   - Global `Skill` table stores canonical skill names
   - `ProfileSkill` links profiles to skills with user-specific metadata (category, proficiency)
   - `resolveSkillIds()` batch-upserts Skill records before creating ProfileSkill links
   - Unique constraint on (profileId, name) prevents duplicate skills per profile

4. **Experience Validation**:
   - startDate must be before endDate
   - If isCurrent=true, endDate must be null
   - Validation runs before transaction

5. **Visibility Filtering**:
   - Owner always sees full profile
   - PUBLIC: All fields visible to everyone
   - CONNECTIONS_ONLY: Limited fields (headline, location, skills)
   - PRIVATE: Minimal fields (headline only)
   - Use `getPublicProfile(targetUserId, currentUser?)` for visibility-aware reads

6. **Profile Search**:
   - Full-text search via PostgreSQL `websearch_to_tsquery` and `ts_rank`
   - Searches `profiles.search_vector` (tsvector column)
   - Only PUBLIC profiles included in search results
   - Returns ranked results with pagination (limit/offset)
   - Query sanitization: allow only word chars, spaces, hyphens

7. **Skill Endorsements**:
   - Users can endorse skills on other profiles
   - Self-endorsement blocked
   - Unique constraint on (profileSkillId, endorserId) prevents duplicates
   - Endorsement count tracked via `endorsements` relation

### Testing Requirements

- Test on-demand profile creation (first access)
- Test replace semantics for sub-entity arrays (skills, experiences, etc.)
- Test skill normalization (case-insensitive, trimmed)
- Test duplicate skill prevention (unique constraint)
- Test experience date validation (startDate < endDate, isCurrent logic)
- Test visibility filtering for each ProfileVisibility level
- Test full-text search ranking and sanitization
- Test self-endorsement prevention
- Test duplicate endorsement prevention
- Test ProfileUpdated event emission

### Common Patterns

- **On-Demand Creation**: Profile created automatically on first read if missing
- **Replace Semantics**: Sub-entity arrays fully replaced, not merged
- **Skill Taxonomy**: Normalized skill names in global Skill table
- **Transactional Integrity**: All mutations in `prisma.$transaction()` with savepoints
- **Visibility Filtering**: Return different field sets based on ProfileVisibility
- **Full-Text Search**: PostgreSQL tsvector with websearch_to_tsquery
- **Event Emission**: ProfileUpdated event after successful update

### Error Handling

- `NotFoundException`: Profile or skill not found
- `BadRequestException`: Invalid dates, self-endorsement attempt
- `ConflictException`: Duplicate skill name, duplicate endorsement (P2002)

### Performance Considerations

- Batch skill resolution: single query for all skills, not N+1
- Search uses indexed tsvector column for fast full-text queries
- Visibility filtering happens in application layer, not database
- Sub-entity replacement uses deleteMany + createMany for efficiency

## Dependencies

### Internal
- `../infra` - PrismaService for database access
- `../outbox` - OutboxService for ProfileUpdated event emission
- `../common/auth` - CurrentUser decorator, AuthenticatedUser interface

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `@prisma/client` - ProfileVisibility enum, Prisma types

### Database Tables
- `profiles` - Main profile records with userId, headline, about, visibility, search_vector
- `profile_skills` - User skills with category and proficiency
- `skills` - Global skill taxonomy (normalized names)
- `experiences` - Work experience records
- `educations` - Education records
- `certifications` - Certification records
- `profile_languages` - Language proficiency records
- `endorsements` - Skill endorsements from other users

### Database Indexes
- `profiles.search_vector` - GIN index for full-text search
- `profiles.userId` - Unique index for profile lookup
- `profile_skills(profileId, name)` - Unique constraint
- `endorsements(profileSkillId, endorserId)` - Unique constraint
