import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT, type RedisClient } from '../redis';

const LOCK_KEY_PREFIX = 'mdc:leader-lock';

@Injectable()
export class LeaderLockService {
  private readonly ownerId = randomUUID();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async runIfLeader(
    lockName: string,
    ttlMs: number,
    work: () => Promise<void>,
  ): Promise<boolean> {
    const key = `${LOCK_KEY_PREFIX}:${lockName}`;
    const token = `${this.ownerId}:${randomUUID()}`;
    const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return false;

    try {
      await work();
      return true;
    } finally {
      await this.release(key, token);
    }
  }

  private async release(key: string, token: string): Promise<void> {
    await this.redis.eval(
      `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
      `,
      1,
      key,
      token,
    );
  }
}
