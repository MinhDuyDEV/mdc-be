import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../config';
import { REDIS_CLIENT } from './redis.constants';

export type RedisClient = Redis;

export const redisProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<AppConfig, true>): RedisClient => {
    const redisUrl = configService.get('redisUrl', { infer: true });
    return new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  },
};
