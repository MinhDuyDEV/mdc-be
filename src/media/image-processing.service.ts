import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { StorageService } from '../infra/storage/storage.service';

export const SHARP = Symbol('SHARP');

export interface ThumbnailSize {
  width: number;
  s3Key: string;
  sizeBytes: number;
}

export interface ThumbnailResult {
  sizes: ThumbnailSize[];
}

interface SharpLike {
  (input: Buffer | string): {
    limitInputPixels: (pixels: number) => SharpLikeInternal;
    resize: (
      width: number,
      height: number | null,
      options?: Record<string, unknown>,
    ) => SharpLikeInternal;
  };
}

interface SharpLikeInternal {
  resize: (
    width: number,
    height: number | null,
    options?: Record<string, unknown>,
  ) => SharpLikeInternal;
  webp: (options?: Record<string, unknown>) => SharpLikeInternal & {
    toBuffer: (options?: Record<string, unknown>) => Promise<Buffer>;
  };
  toBuffer: (options?: Record<string, unknown>) => Promise<Buffer>;
}

export interface ThumbnailableAsset {
  id: string;
  s3Bucket: string;
  contentType: string;
}

const THUMB_WIDTHS = [320, 640, 1280] as const;
const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Generates WebP thumbnails for an uploaded media asset buffer. The
 * caller is responsible for downloading the original from object
 * storage; this service only handles the resize + WebP encode + upload
 * + metadata persistence.
 */
@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  constructor(
    @Inject(SHARP) private readonly sharpFn: SharpLike,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async generateThumbnails(
    buffer: Buffer,
    asset: ThumbnailableAsset,
  ): Promise<ThumbnailResult> {
    if (!IMAGE_CONTENT_TYPES.has(asset.contentType)) {
      return { sizes: [] };
    }

    const sizes: ThumbnailSize[] = [];
    let firstKey: string | undefined;

    for (const width of THUMB_WIDTHS) {
      const key = `thumbnails/${asset.id}/${width}w.webp`;
      const webpBuffer = await this.sharpFn(buffer)
        .limitInputPixels(50_000_000)
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      await this.storage.putObject(asset.s3Bucket, key, webpBuffer, {
        contentType: 'image/webp',
      });
      sizes.push({ width, s3Key: key, sizeBytes: webpBuffer.length });
      firstKey ??= key;
    }

    if (firstKey) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { thumbS3Key: firstKey, thumbGeneratedAt: new Date() },
      });
    }

    this.logger.log(
      `Generated ${sizes.length} thumbnails for media ${asset.id}`,
    );
    return { sizes };
  }
}
