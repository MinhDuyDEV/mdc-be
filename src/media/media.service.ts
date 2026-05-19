import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

      await this.outboxService.emit(tx as any, {
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

  async getDownloadUrl(user: AuthenticatedUser, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!asset || asset.ownerId !== user.id) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.status === 'DELETED' || asset.status === 'QUARANTINED') {
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

      await this.outboxService.emit(tx as any, {
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
}
