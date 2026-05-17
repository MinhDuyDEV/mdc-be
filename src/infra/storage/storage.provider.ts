import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import type { StorageClient } from './storage.constants';
import { STORAGE_CLIENT } from './storage.constants';

export const storageProvider = {
  provide: STORAGE_CLIENT,
  inject: [ConfigService],
  useFactory: (
    configService: ConfigService<AppConfig, true>,
  ): StorageClient => {
    const region = configService.get('s3Region', { infer: true });
    const endpoint = configService.get('s3Endpoint', { infer: true });
    const accessKeyId = configService.get('s3AccessKeyId', { infer: true });
    const secretAccessKey = configService.get('s3SecretAccessKey', {
      infer: true,
    });
    const forcePathStyle = configService.get('s3ForcePathStyle', {
      infer: true,
    });

    return new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  },
};
