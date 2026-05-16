import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { type AppConfig } from '../config';

export type RedisClient = Redis;

export const redisProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<AppConfig, true>): RedisClient => {
    const redisUrl = configService.get('redisUrl', { infer: true });
    const commandTimeout = configService.get('healthRedisTimeoutMs', { infer: true });
    const options: RedisOptions = {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: commandTimeout,
      commandTimeout,
    };

    return new Redis(redisUrl, options);
  },
};
