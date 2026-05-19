<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# Media DTOs

Data transfer objects for media upload operations including initiation and confirmation.

## Purpose

This directory contains DTOs for multipart file upload workflows. These DTOs validate upload metadata (purpose, filename, content type, size) and handle the two-phase upload process: initiation (request presigned URL) and confirmation (finalize upload).

## Key Files

- **initiate-upload.dto.ts** — Validates upload initiation with purpose, filename, content type, and file size
- **confirm-upload.dto.ts** — Empty body DTO; upload ID comes from URL parameter

## For AI Agents

### Working Instructions

- `InitiateUploadDto` uses `@IsIn(['avatar', 'resume', 'attachment'])` to restrict upload purposes
- File size uses `@IsInt() @Min(1)` to ensure positive byte count
- Content type is a string (e.g., 'image/jpeg', 'application/pdf')
- Filename is a string with no length constraint in DTO (validation may occur in service)
- `ConfirmUploadDto` is empty; the upload ID is extracted from the URL path parameter
- Upload workflow: client initiates → receives presigned URL → uploads file → confirms completion

### Testing Requirements

- Test valid upload purposes (avatar, resume, attachment)
- Test invalid upload purposes (document, profile, etc.)
- Test file size boundaries (0, 1, large values)
- Test content type string format
- Test filename string format
- Test empty body handling for confirm endpoint
- Test URL parameter extraction for upload ID

### Common Patterns

- Purpose validation: `@IsIn(['avatar', 'resume', 'attachment'])`
- File size validation: `@IsInt() @Min(1)` for positive integers
- String fields: No decorators for basic string acceptance
- Empty body DTOs: Used when all data comes from URL parameters
- Two-phase uploads: Initiate (get presigned URL) → Upload (client) → Confirm (finalize)

## Dependencies

### Internal
- Used by `MediaController` for upload endpoints
- Used by `MediaService` for upload orchestration
- Integrates with storage infrastructure (S3, cloud storage)
- May integrate with virus scanning or content validation

### External
- `class-validator` — Decorator-based validation
- `@nestjs/common` — NestJS framework integration
