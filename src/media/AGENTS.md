<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# media

## Purpose
Media asset management module providing secure file upload/download via S3 presigned URLs. Supports avatars, resumes, and attachments with content type validation, size limits, and lifecycle management (PENDING → READY → DELETED).

## Key Files
| File | Description |
|------|-------------|
| `media.module.ts` | Module configuration importing InfraModule and OutboxModule |
| `media.controller.ts` | REST endpoints for upload initiation, confirmation, download, deletion |
| `media.service.ts` | Service methods for presigned URL generation and asset lifecycle |
| `media-cleanup.service.ts` | Background job for cleaning up orphaned S3 objects |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for media endpoints (see `dto/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Upload flow: client calls initiate → uploads to presigned URL → calls confirm
- Initiate validates content type and size, generates presigned upload URL (5 min expiry)
- Confirm verifies S3 object exists, matches content type, and enforces size limit (belts and suspenders)
- Confirm atomically updates status to READY and emits MediaAssetCompleted event
- Delete is soft delete (status → DELETED), S3 object remains for cleanup job
- Download generates presigned download URL (5 min expiry) for READY assets
- Size limits vary by purpose: avatar, resume, attachment (configured in AppConfig)
- Only asset owners can confirm, download, or delete their assets

### Testing Requirements
- Test upload flow: initiate → upload to S3 → confirm
- Test content type validation at initiate and confirm
- Test size limit enforcement at initiate and confirm
- Test ownership checks: user cannot confirm/download/delete another user's asset
- Test status transitions: PENDING → READY → DELETED
- Test presigned URL expiration (5 minutes)
- Verify MediaAssetCompleted and MediaAssetDeleted events are emitted

### Common Patterns
- Use transactions for confirm and delete to ensure atomicity of status update + outbox event
- S3 keys use format: `{purpose}/{uuid}-{filename}`
- Presigned URLs expire after 300 seconds (5 minutes)
- Ownership checks: asset.ownerId === user.id
- Status checks: DELETED and QUARANTINED assets return 404

## Dependencies

### Internal
- `../infra/prisma` - Database access for media_assets table
- `../infra/storage` - S3 presigned URL generation and object verification
- `../infra/config` - Content type whitelist, size limits, S3 bucket name
- `../outbox` - Event emission for MediaAssetCompleted, MediaAssetDeleted
- `../common/auth` - CurrentUser decorator and AuthenticatedUser interface

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `crypto` - randomUUID for S3 key generation
