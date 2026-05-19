<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# Users DTOs

Data transfer objects for user profile management and response serialization.

## Purpose

This directory contains DTOs for user-related operations including profile updates and standardized response formatting. These DTOs ensure consistent data structure across user endpoints and control which fields are exposed to clients.

## Key Files

- **update-profile.dto.ts** — Validates optional display name updates (max 100 chars)
- **user-response.dto.ts** — Serializes user data for API responses with selective field exposure

## For AI Agents

### Working Instructions

- `UpdateProfileDto` uses `@IsOptional()` to allow partial updates
- `UserResponseDto` uses `@Exclude()` and `@Expose()` decorators from `class-transformer` for selective serialization
- Response DTOs never include sensitive fields like password hashes
- All string fields have length constraints to prevent data bloat
- Response DTOs are read-only representations of domain entities

### Testing Requirements

- Test partial updates (omitting optional fields)
- Test display name length boundaries (0, 1, 100, 101 chars)
- Test response serialization excludes all non-exposed fields
- Test response includes all required fields (id, email, status, timestamps)
- Verify null/undefined handling for nullable fields

### Common Patterns

- Update DTOs: `@IsOptional()` for all fields to support partial updates
- Response DTOs: `@Exclude()` class decorator with `@Expose()` on each field
- Timestamp fields: Exposed as `Date` objects in responses
- Status fields: String enums from database (e.g., 'active', 'inactive')
- Nullable fields: `string | null` or `Date | null` in response DTOs

## Dependencies

### Internal
- Used by `UsersController` for request/response handling
- Used by `UsersService` for profile management
- Extends user domain entity

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Selective field serialization with `@Exclude()` and `@Expose()`
- `@nestjs/common` — NestJS framework integration
