import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { STORAGE_CLIENT } from './storage.constants';

export interface PresignedUploadOptions {
  contentType?: string;
  contentLength?: number;
  expiresInSeconds?: number;
}

export interface ObjectMetadata {
  contentLength: number;
  contentType: string;
  etag: string;
  lastModified: Date;
}

@Injectable()
export class StorageService implements OnApplicationShutdown {
  constructor(@Inject(STORAGE_CLIENT) private readonly s3: S3Client) {}

  async generatePresignedUploadUrl(
    bucket: string,
    key: string,
    expiresInSecondsOrOptions: number | PresignedUploadOptions = 300,
  ): Promise<string> {
    const options: PresignedUploadOptions =
      typeof expiresInSecondsOrOptions === 'number'
        ? { expiresInSeconds: expiresInSecondsOrOptions }
        : expiresInSecondsOrOptions;

    const { contentType, contentLength, expiresInSeconds = 300 } = options;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
      ...(contentLength ? { ContentLength: contentLength } : {}),
    });
    const signableHeaders = new Set<string>(['host']);
    if (contentType) {
      signableHeaders.add('content-type');
    }
    return getSignedUrl(this.s3, command, {
      expiresIn: expiresInSeconds,
      signableHeaders,
    });
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

  async verifyObject(
    bucket: string,
    key: string,
  ): Promise<ObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const response = await this.s3.send(command);
      return {
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        etag: response.ETag ?? '',
        lastModified: response.LastModified ?? new Date(),
      };
    } catch {
      return null;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await this.s3.send(command);
  }

  /**
   * Downloads an object as a buffer. Used by background processors
   * (virus scanning, thumbnail generation) that need the raw bytes
   * for in-process transformation.
   */
  async getObject(bucket: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.s3.send(command);
    const stream = response.Body as NodeJS.ReadableStream | undefined;
    if (!stream) {
      throw new Error(`S3 object ${bucket}/${key} returned no body`);
    }
    return await streamToBuffer(stream);
  }

  /**
   * Uploads a buffer to the given bucket/key with optional content type.
   * Used by background processors (image thumbnails, generated exports)
   * where a presigned upload URL is not appropriate.
   */
  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    options: { contentType?: string; metadata?: Record<string, string> } = {},
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ...(options.contentType ? { ContentType: options.contentType } : {}),
      ...(options.metadata ? { Metadata: options.metadata } : {}),
    });
    await this.s3.send(command);
  }

  onApplicationShutdown(): void {
    this.s3.destroy();
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
