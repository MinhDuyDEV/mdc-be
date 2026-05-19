<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# storage

## Purpose
AWS S3 integration for object storage operations including presigned URL generation for uploads/downloads, object metadata verification, and bucket health checks. Provides secure, time-limited access to S3 resources with automatic client lifecycle management.

## Key Files
| File | Description |
|------|-------------|
| `storage.service.ts` | Core S3 operations: presigned URLs, object verification, deletion, and bucket checks |
| `storage.health.ts` | Health check service with timeout protection for S3 bucket connectivity |
| `storage.provider.ts` | Factory provider that creates S3Client with region and credential configuration |
| `storage.constants.ts` | DI token and type definitions for S3 client |
| `index.ts` | Public exports for the storage module |

## For AI Agents

### Working In This Directory
- Storage client is provided via `storageProvider` factory using AWS SDK v3
- S3Client is configured with region, endpoint, credentials, and path-style settings
- `StorageService` implements `OnApplicationShutdown` to properly destroy client connections
- Presigned URLs support both upload (PUT) and download (GET) operations
- Upload URLs can include optional content-type and content-length headers for validation
- Object verification returns metadata or null if object doesn't exist
- Health checks use `HeadBucketCommand` to verify bucket accessibility

### Testing Requirements
- Verify storage provider creates S3Client with correct region and credentials
- Test `generatePresignedUploadUrl()` with various expiration times and content types
- Confirm `generatePresignedDownloadUrl()` generates valid download URLs
- Validate `headBucket()` succeeds for accessible buckets
- Test `verifyObject()` returns metadata for existing objects and null for missing ones
- Verify health check timeout behavior (should reject if bucket check exceeds timeout)
- Ensure `deleteObject()` successfully removes objects from S3
- Test `onApplicationShutdown()` properly destroys client connection

### Common Patterns
- Inject `STORAGE_CLIENT` token to access S3Client
- Use `StorageService` methods for all S3 operations
- Presigned URLs default to 300 seconds (5 minutes) expiration
- Upload URLs include `signableHeaders` set for content-type validation
- Object metadata includes: `contentLength`, `contentType`, `etag`, `lastModified`
- Health checks use timeout wrapper pattern with `Promise.race()` and `setTimeout()`
- Configuration values are retrieved via `ConfigService.get()` with `infer: true`

## Dependencies

### Internal
- `../config` — AppConfig type for S3 configuration

### External
- `@nestjs/common` — NestJS core decorators and lifecycle interfaces
- `@nestjs/config` — NestJS configuration service
- `@aws-sdk/client-s3` — AWS SDK v3 S3 client
- `@aws-sdk/s3-request-presigner` — Presigned URL generation utility
