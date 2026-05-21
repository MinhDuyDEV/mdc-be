import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../infra/redis/redis.constants';

@Injectable()
export class RealtimeService {
  private readonly PRESENCE_TTL = 60; // seconds
  private readonly PRESENCE_PREFIX = 'presence:user:';

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async setUserOnline(userId: string): Promise<void> {
    const key = `${this.PRESENCE_PREFIX}${userId}`;
    await this.redis.setex(key, this.PRESENCE_TTL, Date.now().toString());
  }

  async setUserOffline(userId: string): Promise<void> {
    const key = `${this.PRESENCE_PREFIX}${userId}`;
    await this.redis.del(key);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const key = `${this.PRESENCE_PREFIX}${userId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async refreshPresence(userId: string): Promise<void> {
    const key = `${this.PRESENCE_PREFIX}${userId}`;
    await this.redis.expire(key, this.PRESENCE_TTL);
  }
}
