import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner');

describe('StorageService', () => {
  let service: StorageService;
  let mockSend: jest.Mock;
  let mockDestroy: jest.Mock;
  let mockS3: { send: jest.Mock; destroy: jest.Mock };

  beforeEach(() => {
    mockSend = jest.fn();
    mockDestroy = jest.fn();
    mockS3 = {
      send: mockSend,
      destroy: mockDestroy,
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    service = new StorageService(mockS3 as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generatePresignedUploadUrl resolves', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://presigned-upload-url',
    );

    const url = await service.generatePresignedUploadUrl('bucket', 'key', 60);
    expect(url).toBe('https://presigned-upload-url');
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('generatePresignedDownloadUrl resolves', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://presigned-download-url',
    );

    const url = await service.generatePresignedDownloadUrl('bucket', 'key', 60);
    expect(url).toBe('https://presigned-download-url');
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('headBucket resolves', async () => {
    mockSend.mockResolvedValue({});
    await expect(service.headBucket('bucket')).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('headBucket rejects on error', async () => {
    mockSend.mockRejectedValue(new Error('Bucket not found'));
    await expect(service.headBucket('bucket')).rejects.toThrow(
      'Bucket not found',
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
