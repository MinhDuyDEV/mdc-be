import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Test, type TestingModule } from '@nestjs/testing';
import { STORAGE_CLIENT } from './storage.constants';
import { type ObjectMetadata, StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://signed.example.com/upload'),
}));

describe('StorageService', () => {
  let service: StorageService;
  let mockSend: jest.Mock;
  let mockDestroy: jest.Mock;
  let mockS3: any;

  beforeEach(async () => {
    mockSend = jest.fn();
    mockDestroy = jest.fn();
    mockS3 = {
      send: mockSend,
      destroy: mockDestroy,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_CLIENT, useValue: mockS3 },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate a presigned upload URL with default expiry', async () => {
      const url = await service.generatePresignedUploadUrl('bucket', 'key.jpg');
      expect(url).toBe('https://signed.example.com/upload');
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 300 }),
      );
    });

    it('should enforce content-type via signableHeaders', async () => {
      await service.generatePresignedUploadUrl('bucket', 'key.jpg', {
        contentType: 'image/jpeg',
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          signableHeaders: expect.any(Set),
        }),
      );
    });

    it('should accept legacy number argument for backward compat', async () => {
      await service.generatePresignedUploadUrl('bucket', 'key.jpg', 60);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 60 }),
      );
    });
  });

  describe('verifyObject', () => {
    it('should return metadata when object exists', async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: 1024,
        ContentType: 'image/jpeg',
        ETag: '"abc123"',
        LastModified: new Date('2026-01-01'),
      });

      const meta: ObjectMetadata | null = await service.verifyObject(
        'bucket',
        'key.jpg',
      );
      expect(meta).not.toBeNull();
      expect(meta!.contentLength).toBe(1024);
      expect(meta!.contentType).toBe('image/jpeg');
      expect(meta!.etag).toBe('"abc123"');
    });

    it('should return null when object does not exist', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFound'));
      const meta = await service.verifyObject('bucket', 'missing.jpg');
      expect(meta).toBeNull();
    });

    it('should return null when S3 call fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));
      const meta = await service.verifyObject('bucket', 'key.jpg');
      expect(meta).toBeNull();
    });
  });

  describe('deleteObject', () => {
    it('should send a DeleteObjectCommand', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.deleteObject('bucket', 'key.jpg');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
