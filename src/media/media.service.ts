import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionStatus, MediaVisibility } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import type { AppConfig } from '../infra/config/app-config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { StorageService } from '../infra/storage/storage.service';
import { OutboxService } from '../outbox/outbox.service';
import type { InitiateUploadDto } from './dto/initiate-upload.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly outboxService: OutboxService,
  ) {}

  async initiateUpload(user: AuthenticatedUser, dto: InitiateUploadDto) {
    const { purpose, filename, contentType, sizeBytes } = dto;

    // Validate content type
    const allowedContentTypes = this.config.get('mediaAllowedContentTypes', {
      infer: true,
    });
    if (!allowedContentTypes.includes(contentType)) {
      throw new BadRequestException('Content type not allowed');
    }

    // Validate size
    const maxSizeBytes = this.getMaxSizeBytes(purpose);
    if (sizeBytes > maxSizeBytes) {
      throw new BadRequestException('File size exceeds maximum allowed');
    }

    const bucket = this.config.get('s3Bucket', { infer: true });
    const s3Key = `${purpose}/${randomUUID()}-${filename}`;

    const mediaAsset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: user.id,
        purpose,
        filename,
        s3Key,
        s3Bucket: bucket,
        contentType,
        sizeBytes: sizeBytes ?? null,
        status: 'PENDING',
        visibility: MediaVisibility.PRIVATE,
      },
    });

    const uploadUrl = await this.storage.generatePresignedUploadUrl(
      bucket,
      s3Key,
      {
        contentType,
        contentLength: sizeBytes,
        expiresInSeconds: 300,
      },
    );

    return {
      mediaId: mediaAsset.id,
      uploadUrl,
      expiresIn: 300,
    };
  }

  async confirmUpload(user: AuthenticatedUser, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this media asset');
    }

    // Only PENDING assets can be confirmed
    if (asset.status !== 'PENDING') {
      throw new BadRequestException('Media asset is not pending confirmation');
    }

    const metadata = await this.storage.verifyObject(
      asset.s3Bucket,
      asset.s3Key,
    );

    if (!metadata) {
      throw new BadRequestException('Upload not completed or object not found');
    }

    if (metadata.contentType !== asset.contentType) {
      throw new BadRequestException('Content type mismatch');
    }

    // Enforce size limit at confirmation time (belts and suspenders)
    const maxSizeBytes = this.getMaxSizeBytes(asset.purpose);
    if (metadata.contentLength > maxSizeBytes) {
      throw new BadRequestException('File size exceeds maximum allowed');
    }

    // Atomic: update status + emit event in one transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.mediaAsset.update({
        where: { id: mediaId },
        data: {
          status: 'READY',
          etag: metadata.etag,
          sizeBytes: metadata.contentLength,
        },
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

      return result;
    });

    return updated;
  }

  /**
   * Validate that all media asset IDs exist and are owned by the specified user.
   * Returns the validated asset IDs. Throws if any are missing or not owned.
   */
  async validateOwnership(
    ownerId: string,
    mediaAssetIds: string[],
  ): Promise<string[]> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        id: { in: mediaAssetIds },
        ownerId,
      },
      select: { id: true },
    });

    if (assets.length !== mediaAssetIds.length) {
      throw new BadRequestException('INVALID_ATTACHMENTS');
    }

    return assets.map((a) => a.id);
  }

  private getMaxSizeBytes(purpose: string): number {
    switch (purpose) {
      case 'avatar':
        return this.config.get('mediaAvatarMaxSizeBytes', { infer: true });
      case 'resume':
        return this.config.get('mediaResumeMaxSizeBytes', { infer: true });
      case 'attachment':
        return this.config.get('mediaResumeMaxSizeBytes', { infer: true });
      default:
        return this.config.get('mediaResumeMaxSizeBytes', { infer: true });
    }
  }

  async getDownloadUrl(user: AuthenticatedUser | undefined, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.status === 'DELETED' || asset.status === 'QUARANTINED') {
      throw new NotFoundException('Media asset not found');
    }

    const canRead = await this.canReadAsset(user, asset);
    if (!canRead) {
      throw new NotFoundException('Media asset not found');
    }

    const downloadUrl = await this.storage.generatePresignedDownloadUrl(
      asset.s3Bucket,
      asset.s3Key,
      300,
    );

    return {
      mediaId: asset.id,
      downloadUrl,
      expiresIn: 300,
      filename: asset.filename,
      contentType: asset.contentType,
    };
  }

  async deleteAsset(user: AuthenticatedUser, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!asset || asset.ownerId !== user.id) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.status === 'DELETED') {
      throw new NotFoundException('Media asset not found');
    }

    // Atomic: soft delete + emit event in one transaction (keep S3 object for now)
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.mediaAsset.update({
        where: { id: mediaId },
        data: { status: 'DELETED' },
      });

      await this.outboxService.emit(tx, {
        eventType: 'MediaAssetDeleted',
        aggregateType: 'MediaAsset',
        aggregateId: asset.id,
        payload: {
          mediaId: asset.id,
          ownerId: asset.ownerId,
          purpose: asset.purpose,
          s3Key: asset.s3Key,
          s3Bucket: asset.s3Bucket,
        },
      });

      return result;
    });

    return updated;
  }

  private async canReadAsset(
    user: AuthenticatedUser | undefined,
    asset: { ownerId: string; visibility: MediaVisibility },
  ): Promise<boolean> {
    if (asset.visibility === MediaVisibility.PUBLIC) {
      return true;
    }

    if (!user) {
      return false;
    }

    if (asset.ownerId === user.id) {
      return true;
    }

    if (asset.visibility !== MediaVisibility.CONNECTIONS_ONLY) {
      return false;
    }

    const connection = await this.prisma.connection.findFirst({
      where: {
        status: ConnectionStatus.ACCEPTED,
        OR: [
          { requesterId: user.id, addresseeId: asset.ownerId },
          { requesterId: asset.ownerId, addresseeId: user.id },
        ],
      },
      select: { id: true },
    });

    return connection !== null;
  }
}
