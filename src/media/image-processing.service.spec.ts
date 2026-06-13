import { ImageProcessingService, SHARP } from './image-processing.service';
import type { StorageService } from '../infra/storage/storage.service';
import type { PrismaService } from '../infra/prisma/prisma.service';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;
  let sharpMock: {
    limitInputPixels: jest.Mock;
    resize: jest.Mock;
    webp: jest.Mock;
    toBuffer: jest.Mock;
  };
  let sharpFactory: jest.Mock;
  let storage: { putObject: jest.Mock };
  let prisma: { mediaAsset: { update: jest.Mock } };

  beforeEach(() => {
    sharpMock = {
      limitInputPixels: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp-bytes')),
    };
    sharpFactory = jest.fn(() => sharpMock);
    storage = { putObject: jest.fn().mockResolvedValue(undefined) };
    prisma = { mediaAsset: { update: jest.fn().mockResolvedValue({}) } };
    service = new ImageProcessingService(
      sharpFactory as never,
      storage as unknown as StorageService,
      prisma as unknown as PrismaService,
    );
    // Provide the SHARP token via the module's DI metadata, but for unit
    // tests we directly call the constructor and reference the same
    // instance. The token matters at the module layer.
    void SHARP;
  });

  it('generates 320, 640, and 1280 WebP thumbnails', async () => {
    const result = await service.generateThumbnails(Buffer.from('orig'), {
      id: 'asset-1',
      s3Bucket: 'b',
      contentType: 'image/png',
    });

    expect(sharpFactory).toHaveBeenCalledTimes(3);
    expect(sharpMock.resize).toHaveBeenCalledTimes(3);
    expect(sharpMock.resize.mock.calls.map((c) => c[0])).toEqual([
      320, 640, 1280,
    ]);
    expect(result.sizes).toHaveLength(3);
    expect(result.sizes.map((s) => s.width)).toEqual([320, 640, 1280]);
  });

  it('uploads each thumbnail with a deterministic key', async () => {
    await service.generateThumbnails(Buffer.from('orig'), {
      id: 'asset-1',
      s3Bucket: 'b',
      contentType: 'image/png',
    });

    const keys = storage.putObject.mock.calls.map((c) => c[1]);
    expect(keys).toEqual([
      'thumbnails/asset-1/320w.webp',
      'thumbnails/asset-1/640w.webp',
      'thumbnails/asset-1/1280w.webp',
    ]);
  });

  it('updates MediaAsset.thumbS3Key and thumbGeneratedAt', async () => {
    await service.generateThumbnails(Buffer.from('orig'), {
      id: 'asset-1',
      s3Bucket: 'b',
      contentType: 'image/png',
    });

    expect(prisma.mediaAsset.update).toHaveBeenCalledTimes(1);
    const args = prisma.mediaAsset.update.mock.calls[0][0];
    expect(args.where.id).toBe('asset-1');
    expect(args.data.thumbS3Key).toBe('thumbnails/asset-1/320w.webp');
    expect(args.data.thumbGeneratedAt).toBeInstanceOf(Date);
  });

  it('skips non-image content types without throwing', async () => {
    const result = await service.generateThumbnails(Buffer.from('orig'), {
      id: 'asset-1',
      s3Bucket: 'b',
      contentType: 'application/pdf',
    });
    expect(result.sizes).toEqual([]);
    expect(sharpFactory).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
  });
});
