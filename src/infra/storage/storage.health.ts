import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import type { StorageClient } from './storage.constants';
import { STORAGE_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

@Injectable()
export class StorageHealthService {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly s3: StorageClient,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async ping(): Promise<void> {
    const timeoutMs = this.configService.get('healthS3TimeoutMs', {
      infer: true,
    });
    const bucket = this.configService.get('s3Bucket', { infer: true });

    await this.withTimeout(async () => {
      const service = new StorageService(this.s3);
      await service.headBucket(bucket);
    }, timeoutMs);
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('S3 health check timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  onApplicationShutdown(): void {
    this.s3.destroy();
  }
}
