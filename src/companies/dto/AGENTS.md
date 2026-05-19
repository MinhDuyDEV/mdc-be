<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# Companies DTOs

Data transfer objects for company management including creation, updates, member operations, and response serialization.

## Purpose

This directory contains DTOs for company-related operations including company profile management, member invitations, role assignments, and recruiter seat allocation. These DTOs validate company data, member operations, and serialize company information for API responses.

## Key Files

- **create-company.dto.ts** — Validates company creation with name, industry, description, website, employee count, founded year, and headquarters
- **update-company.dto.ts** — Extends `PartialType(CreateCompanyDto)` with optional logo and cover media asset IDs
- **company-response.dto.ts** — Serializes company data with nested member information for API responses
- **add-member.dto.ts** — Validates adding existing user to company with user ID and role
- **invite-member.dto.ts** — Validates inviting new member with email and role
- **update-member-role.dto.ts** — Validates member role updates with new role enum
- **accept-invitation.dto.ts** — Validates invitation acceptance with token
- **allocate-recruiter-seat.dto.ts** — Validates recruiter seat allocation with user ID
- **list-companies.dto.ts** — Validates company listing with pagination (limit 1-100, cursor) and search query

## For AI Agents

### Working Instructions

- `CreateCompanyDto` uses `@IsEnum(Industry)` with Prisma Industry enum
- `UpdateCompanyDto` extends `PartialType(CreateCompanyDto)` to make all fields optional
- Member operations use `@IsEnum(CompanyRole)` with Prisma CompanyRole enum
- UUID fields use `@IsUUID()` for validation
- Founded year uses `@Min(1800)` and `@Max(current year)` constraints
- Response DTOs use `@Exclude()` and `@Expose()` with nested `@Type()` for member arrays
- List DTOs use `@Type(() => Number)` to coerce string query params to numbers
- Email fields use `@IsEmail()` for RFC 5322 compliance

### Testing Requirements

- Test company creation with all required and optional fields
- Test industry enum validation
- Test founded year boundaries (1799, 1800, current year, current year + 1)
- Test employee count string format
- Test URL validation for website field
- Test member role enum validation (OWNER, ADMIN, RECRUITER, MEMBER)
- Test UUID validation for user IDs and media asset IDs
- Test pagination boundaries (limit 1-100, cursor string)
- Test email validation for invitations
- Test response serialization includes nested members
- Test null/undefined handling for nullable fields

### Common Patterns

- Company data: `@IsEnum(Industry)` with Prisma enums
- Member operations: `@IsEnum(CompanyRole)` for role validation
- UUID validation: `@IsUUID()` for user and media asset IDs
- Year validation: `@Min(1800) @Max(new Date().getFullYear())`
- Partial updates: `PartialType(CreateCompanyDto)` for update DTOs
- Response DTOs: `@Exclude()` class decorator with `@Expose()` on each field
- Nested responses: `@Type(() => CompanyMemberResponseDto)` for member arrays
- Pagination: `@Type(() => Number)` with `@Min()` and `@Max()` constraints
- Email validation: `@IsEmail()` for invitation endpoints

## Dependencies

### Internal
- Used by `CompaniesController` for request/response handling
- Used by `CompaniesService` for company management
- Extends company domain entity
- Depends on Prisma enums (Industry, CompanyRole)

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation and selective serialization
- `@nestjs/mapped-types` — `PartialType` for extending DTOs
- `@nestjs/common` — NestJS framework integration
- `@prisma/client` — Enum types for validation
