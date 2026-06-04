<!-- Parent: ../AGENTS.md -->

# Media Module

## Purpose

The Media module handles file upload, storage, and retrieval for the MDC platform. It implements a secure two-phase upload pattern (initiate → upload → confirm) with presigned URLs for direct S3 uploads, visibility controls (PUBLIC, PRIVATE, CONNECTIONS_ONLY), and automatic cleanup of abandoned uploads.

**Key responsibilities:**
- Generate presigned S3 upload URLs with content-type and size validation
- Verify completed uploads and transition assets from PENDING to READY
- Control access to media assets based on visibility and connection status
- Emit outbox events for completed uploads and deletions
- Clean up expired PENDING uploads (1-hour TTL)

## Key Files

### Core Services

- **media.service.ts** - Main service implementing upload lifecycle, access control, and S3 integration
  - `initiateUpload()` - Creates MediaAsset record and generates presigned upload URL
  - `confirmUpload()` - Verifies S3 object exists, validates metadata, marks asset READY
  - `getDownloadUrl()` - Generates presigned download URL with visibility checks
  - `deleteAsset()` - Soft-deletes asset and emits MediaAssetDeleted event
  - `canReadAsset()` - Enforces visibility rules (PUBLIC, PRIVATE, CONNECTIONS_ONLY)
  - `getMaxSizeBytes()` - Returns size limit based on purpose (avatar, resume, attachment)

- **media-cleanup.service.ts** - Scheduled cleanup of abandoned uploads
  - Runs every 5 minutes via leader lock
  - Marks PENDING assets older than 1 hour as DELETED
  - Prevents orphaned S3 objects from incomplete uploads

### Controllers

- **media.controller.ts** - REST API for media operations
  - `POST /media/initiate` - Start upload, get presigned URL
  - `POST /media/:id/confirm` - Confirm upload completion
  - `GET /media/:id` - Get download URL (supports optional auth)
  - `DELETE /media/:id` - Delete media asset

### Configuration

- **media.module.ts** - Module definition
  - Imports: InfraModule (Prisma, Storage, Config), OutboxCoreModule
  - Exports: MediaService for use by other modules

## Subdirectories

### dto/

Input validation and response DTOs:
- **initiate-upload.dto.ts** - Upload initiation request (purpose, filename, contentType, sizeBytes)
- **confirm-upload.dto.ts** - Upload confirmation request

## For AI Agents

### Working with Media

**Upload flow:**
1. Client calls `POST /media/initiate` with file metadata
2. Service validates content-type and size, creates PENDING MediaAsset
3. Service generates presigned S3 upload URL (5-minute expiry)
4. Client uploads directly to S3 using presigned URL
5. Client calls `POST /media/:id/confirm` to verify upload
6. Service checks S3 object exists, validates metadata, marks READY
7. Service emits `MediaAssetCompleted` event in transaction

**Access control:**
- PUBLIC: Anyone can download (even unauthenticated)
- PRIVATE: Only owner can download
- CONNECTIONS_ONLY: Owner + accepted connections can download
- DELETED/QUARANTINED assets return 404 (no existence oracle)

**Cleanup:**
- PENDING assets expire after 1 hour
- MediaCleanupService runs every 5 minutes with leader lock
- Soft-delete only (S3 objects remain for now)

### Testing Requirements

**Unit tests must cover:**
- Upload initiation with valid/invalid content types
- Size limit enforcement (avatar: 5MB, resume: 10MB, attachment: 10MB)
- Upload confirmation with missing/mismatched S3 objects
- Access control for each visibility level
- Connection-based access (CONNECTIONS_ONLY)
- Cleanup of expired PENDING uploads

**Integration tests must verify:**
- Full upload flow (initiate → S3 upload → confirm)
- Presigned URL expiry (5 minutes)
- Outbox event emission (MediaAssetCompleted, MediaAssetDeleted)
- Concurrent upload confirmations (idempotency)
- Leader lock behavior for cleanup job

### Common Patterns

**Two-phase upload:**
```typescript
// Phase 1: Initiate
const { mediaId, uploadUrl } = await mediaService.initiateUpload(user, {
  purpose: 'avatar',
  filename: 'profile.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 1024000,
});

// Client uploads to S3 using uploadUrl

// Phase 2: Confirm (after S3 upload)
const asset = await mediaService.confirmUpload(user, mediaId);
```

**Access control check:**
```typescript
// Service enforces visibility rules
const { downloadUrl } = await mediaService.getDownloadUrl(user, mediaId);
// Returns 404 if user lacks access (no existence oracle)
```

**Outbox event emission:**
```typescript
await this.prisma.$transaction(async (tx) => {
  const asset = await tx.mediaAsset.update({
    where: { id: mediaId },
    data: { status: 'READY', etag: metadata.etag, sizeBytes: metadata.contentLength },
  });

  await this.outboxService.emit(tx, {
    eventType: 'MediaAssetCompleted',
    aggregateType: 'MediaAsset',
    aggregateId: asset.id,
    payload: {
      mediaId: asset.id,
      ownerId: asset.ownerId,
      purpose: asset.purpose,
      contentType: asset.contentType,
      sizeBytes: metadata.contentLength,
    },
  });
});
```

**Connection-based access:**
```typescript
if (asset.visibility === MediaVisibility.CONNECTIONS_ONLY) {
  const connection = await this.prisma.connection.findFirst({
    where: {
      status: ConnectionStatus.ACCEPTED,
      OR: [
        { requesterId: user.id, addresseeId: asset.ownerId },
        { requesterId: asset.ownerId, addresseeId: user.id },
      ],
    },
  });
  return connection !== null;
}
```

### Configuration Keys

From AppConfig (infra/config):
- `mediaAllowedContentTypes` - Whitelist of allowed MIME types
- `mediaAvatarMaxSizeBytes` - Max size for avatar uploads (default: 5MB)
- `mediaResumeMaxSizeBytes` - Max size for resume/attachment uploads (default: 10MB)
- `s3Bucket` - S3 bucket name for media storage

### Media Purposes

- **avatar** - User profile pictures (max 5MB)
- **resume** - Candidate resumes (max 10MB)
- **attachment** - General attachments (max 10MB)

### Media Status Flow

- **PENDING** → **READY** (via confirmUpload)
- **READY** → **DELETED** (via deleteAsset)
- **PENDING** → **DELETED** (via cleanup job after 1 hour)
- **QUARANTINED** - Reserved for future moderation features

### Error Handling

- `BadRequestException('Content type not allowed')` - Invalid MIME type
- `BadRequestException('File size exceeds maximum allowed')` - Size limit exceeded
- `NotFoundException('Media asset not found')` - Asset doesn't exist or user lacks access
- `ForbiddenException('You do not own this media asset')` - Ownership violation
- `BadRequestException('Media asset is not pending confirmation')` - Status not PENDING
- `BadRequestException('Upload not completed or object not found')` - S3 verification failed
- `BadRequestException('Content type mismatch')` - S3 content-type differs from claimed

## Dependencies

### Internal Modules
- **infra/prisma** - Database access (MediaAsset table)
- **infra/storage** - S3 operations (presigned URLs, object verification)
- **infra/config** - Configuration (size limits, allowed types, S3 bucket)
- **infra/scheduling** - Leader lock for cleanup job
- **outbox** - Event emission (MediaAssetCompleted, MediaAssetDeleted)
- **common/auth** - Authentication (CurrentUser, OptionalAuth)

### External Dependencies
- **@nestjs/common** - NestJS framework
- **@nestjs/config** - Configuration service
- **@nestjs/schedule** - Cron job scheduling
- **@prisma/client** - Database client (MediaVisibility, ConnectionStatus enums)
- **crypto** - randomUUID for S3 key generation

### Database Schema
- **media_assets** - Stores upload metadata, S3 keys, status, visibility
- **connections** - Used for CONNECTIONS_ONLY visibility checks

### S3 Key Format

- Pattern: `{purpose}/{uuid}-{filename}`
- Example: `avatar/123e4567-e89b-12d3-a456-426614174000-profile.jpg`

### Presigned URL Expiry

- Upload URLs: 300 seconds (5 minutes)
- Download URLs: 300 seconds (5 minutes)

### Outbox Events Emitted
- **MediaAssetCompleted** - After successful upload confirmation (payload: mediaId, ownerId, purpose, contentType, sizeBytes)
- **MediaAssetDeleted** - After soft-delete operation (payload: mediaId, ownerId, purpose, s3Key, s3Bucket)

### Outbox Events Consumed
- None (media is a leaf domain in the event flow)
