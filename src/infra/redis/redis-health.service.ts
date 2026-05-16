import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';
import { type RedisClient } from './redis.provider';

@Injectable()
export class RedisHealthService implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async ping(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    const response = await this.redis.ping();
    if (response !== 'PONG') {
      throw new Error('Redis ping did not return PONG');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'end') {
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
