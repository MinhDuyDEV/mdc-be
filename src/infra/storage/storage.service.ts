import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { STORAGE_CLIENT } from './storage.constants';

@Injectable()
export class StorageService implements OnApplicationShutdown {
  constructor(@Inject(STORAGE_CLIENT) private readonly s3: S3Client) {}

  async generatePresignedUploadUrl(
    bucket: string,
    key: string,
    expiresInSeconds = 60,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async generatePresignedDownloadUrl(
    bucket: string,
    key: string,
    expiresInSeconds = 60,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async headBucket(bucket: string): Promise<void> {
    const command = new HeadBucketCommand({ Bucket: bucket });
    await this.s3.send(command);
  }

  onApplicationShutdown(): void {
    this.s3.destroy();
  }
}
