import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService, type PrismaTransaction } from '../infra/prisma';
import { LeaderLockService } from '../infra/scheduling';

const IDEMPOTENCY_CLEANUP_LOCK_TTL_MS = 50_000;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  async claim(scope: string, key: string): Promise<unknown>;
  async claim(
    tx: PrismaTransaction,
    scope: string,
    key: string,
  ): Promise<unknown>;
  async claim(
    txOrScope: PrismaTransaction | string,
    scopeOrKey: string,
    maybeKey?: string,
  ): Promise<unknown> {
    const client = typeof txOrScope === 'string' ? this.prisma : txOrScope;
    const scope = typeof txOrScope === 'string' ? txOrScope : scopeOrKey;
    const key = typeof txOrScope === 'string' ? scopeOrKey : maybeKey;

    if (!key) {
      throw new Error('Idempotency key is required');
    }

    try {
      return await client.idempotencyKey.create({
        data: {
          scope,
          key,
          requestHash: '',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });
    } catch (err: unknown) {
      const isP2002 =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as Record<string, unknown>).code === 'P2002';

      if (isP2002) {
        // Unique constraint violation — key exists
        const rows = await client.$queryRaw`
            SELECT * FROM idempotency_keys
            WHERE scope = ${scope} AND key = ${key}
            FOR UPDATE
        `;
        const existing = (rows as Array<Record<string, unknown>>)[0];
        if (existing) return existing;
        throw err; // Re-throw original if no existing row found
      }
      throw err;
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'idempotency-cleanup' })
  async cleanup(): Promise<void> {
    try {
      await this.leaderLock.runIfLeader(
        'idempotency-cleanup',
        IDEMPOTENCY_CLEANUP_LOCK_TTL_MS,
        async () => {
          const result = await this.prisma.idempotencyKey.deleteMany({
            where: { expiresAt: { lt: new Date() } },
          });
          if (result.count > 0) {
            this.logger.log(`Cleaned ${result.count} expired idempotency keys`);
          }
        },
      );
    } catch (err) {
      this.logger.error('Idempotency cleanup failed', err);
    }
  }
}
