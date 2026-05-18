import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PrismaService } from '../infra/prisma';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async claim(scope: string, key: string): Promise<any> {
    try {
      return await this.prisma.idempotencyKey.create({
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
        const rows = await this.prisma.$queryRaw`
          SELECT * FROM idempotency_keys
          WHERE scope = ${scope} AND key = ${key}
          FOR UPDATE
        `;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const existing = rows[0];
        if (existing) return existing;
        throw err; // Re-throw original if no existing row found
      }
      throw err;
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'idempotency-cleanup' })
  async cleanup(): Promise<void> {
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned ${result.count} expired idempotency keys`);
      }
    } catch (err) {
      this.logger.error('Idempotency cleanup failed', err);
    }
  }
}
