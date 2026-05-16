import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from './redis.constants';
import { type RedisClient } from './redis.provider';
import { type AppConfig } from '../config';

@Injectable()
export class RedisHealthService implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async ping(): Promise<void> {
    const timeoutMs = this.configService.get('healthRedisTimeoutMs', {
      infer: true,
    });
    const response = await this.withTimeout(async () => {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      return this.redis.ping();
    }, timeoutMs);
    if (response !== 'PONG') {
      throw new Error('Redis ping did not return PONG');
    }
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
            () => reject(new Error('Redis health check timed out')),
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
