<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# Auth DTOs

Data transfer objects for authentication flows including registration, login, email verification, and password reset operations.

## Purpose

This directory contains DTOs that validate and structure authentication-related HTTP requests and responses. Each DTO enforces specific validation rules using `class-validator` decorators to ensure data integrity at the API boundary.

## Key Files

- **register.dto.ts** — Validates user registration with email, password (8-128 chars), and optional display name
- **login.dto.ts** — Validates login credentials (email and password)
- **verify-email.dto.ts** — Validates email verification token (64-char string)
- **confirm-password-reset.dto.ts** — Validates password reset with token (64-char) and new password (8-128 chars)
- **request-password-reset.dto.ts** — Validates password reset request with email
- **resend-verification.dto.ts** — Validates resend verification email request with email

## For AI Agents

### Working Instructions

- All DTOs use `class-validator` decorators for input validation
- Email fields use `@IsEmail()` for RFC 5322 compliance
- Passwords enforce 8-128 character length with `@MinLength()` and `@MaxLength()`
- Tokens are fixed-length 64-character strings (likely SHA-256 hashes)
- Optional fields use `@IsOptional()` before type-specific decorators
- Display names are optional and limited to 100 characters

### Testing Requirements

- Test valid and invalid email formats
- Test password length boundaries (7, 8, 128, 129 chars)
- Test token validation (63, 64, 65 chars)
- Test optional field omission and presence
- Verify validation errors are descriptive

### Common Patterns

- Email validation: `@IsEmail()` on all email fields
- Password validation: `@IsString() @MinLength(8) @MaxLength(128)`
- Token validation: `@IsString() @Length(64, 64)` for fixed-length tokens
- Optional fields: `@IsOptional()` placed before type decorators
- String constraints: `@MaxLength()` for bounded text fields

## Dependencies

### Internal
- Used by `AuthController` for request validation
- Used by `AuthService` for business logic
- Extends NestJS validation pipeline

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation (minimal use in auth DTOs)
- `@nestjs/common` — NestJS framework integration
