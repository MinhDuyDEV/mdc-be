<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# Profiles DTOs

Data transfer objects for professional profile management including skills, experience, education, certifications, and languages.

## Purpose

This directory contains DTOs for comprehensive profile operations. These DTOs validate nested arrays of professional details, support partial updates via `PartialType`, and serialize profile data for API responses with controlled field exposure.

## Key Files

- **create-profile.dto.ts** — Validates initial profile creation with headline, about, location, website, visibility, and work preferences
- **update-profile.dto.ts** — Extends `CreateProfileDto` with nested arrays for skills, experiences, educations, certifications, and languages
- **profile-response.dto.ts** — Serializes profile data for API responses with selective field exposure
- **skill.dto.ts** — Validates skill entries with name, category, and proficiency level
- **experience.dto.ts** — Validates work experience with title, company, dates, and optional URL/location/description
- **education.dto.ts** — Validates education entries with school, degree, dates, and optional field of study/grade/activities
- **certification.dto.ts** — Validates certifications with name, issuing organization, dates, and optional credential details
- **language.dto.ts** — Validates language proficiency with language name and proficiency level
- **search-profiles.dto.ts** — Validates profile search with query string, limit (1-100), and offset pagination
- **endorse-skill.dto.ts** — Empty body DTO; skill ID and user ID come from URL parameters

## For AI Agents

### Working Instructions

- `UpdateProfileDto` extends `PartialType(CreateProfileDto)` to make all fields optional
- Nested arrays use `@ValidateNested({ each: true })` with `@Type()` for proper validation
- Date fields use `@IsDateString()` for ISO 8601 format validation
- Enum fields use `@IsEnum()` with Prisma enums (ProfileVisibility, SkillCategory, SkillProficiency, LanguageProficiency)
- URL fields use `@IsUrl()` with max length constraints
- Response DTOs use `@Exclude()` and `@Expose()` for selective serialization
- Search DTOs use `@Type(() => Number)` to coerce string query params to numbers

### Testing Requirements

- Test nested array validation (skills, experiences, educations, certifications, languages)
- Test date string format validation (ISO 8601)
- Test enum validation for visibility, categories, and proficiency levels
- Test URL validation with various formats
- Test pagination boundaries (limit 1-100, offset >= 0)
- Test optional field omission and presence
- Test response serialization includes all required fields
- Test null/undefined handling for nullable fields

### Common Patterns

- Nested DTOs: `@ValidateNested({ each: true }) @Type(() => DtoClass)`
- Date validation: `@IsDateString()` for ISO 8601 strings
- Enum validation: `@IsEnum(EnumType)` with Prisma enums
- URL validation: `@IsUrl() @MaxLength(500)`
- Pagination: `@Type(() => Number)` with `@Min()` and `@Max()` constraints
- Optional nested arrays: `@IsOptional() @ValidateNested({ each: true })`
- Response DTOs: `@Exclude()` class decorator with `@Expose()` on each field
- Boolean coercion: `@Type(() => Boolean)` for query parameter conversion

## Dependencies

### Internal
- Used by `ProfilesController` for request/response handling
- Used by `ProfilesService` for profile management
- Extends profile domain entity
- Depends on Prisma enums (ProfileVisibility, SkillCategory, SkillProficiency, LanguageProficiency)

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation and selective serialization
- `@nestjs/mapped-types` — `PartialType` for extending DTOs
- `@nestjs/common` — NestJS framework integration
- `@prisma/client` — Enum types for validation
