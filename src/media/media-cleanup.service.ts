import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../infra/prisma/prisma.service';
import { LeaderLockService } from '../infra/scheduling';

const PENDING_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
const MEDIA_CLEANUP_LOCK_TTL_MS = 50_000;

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'media-cleanup' })
  async cleanup(): Promise<void> {
    try {
      await this.leaderLock.runIfLeader(
        'media-cleanup',
        MEDIA_CLEANUP_LOCK_TTL_MS,
        async () => {
          const expiredBefore = new Date(Date.now() - PENDING_EXPIRATION_MS);
          const result = await this.prisma.mediaAsset.updateMany({
            where: {
              status: 'PENDING',
              createdAt: { lt: expiredBefore },
            },
            data: { status: 'DELETED' },
          });
          if (result.count > 0) {
            this.logger.log(
              `Cleaned ${result.count} expired PENDING media assets`,
            );
          }
        },
      );
    } catch (err) {
      this.logger.error('Media cleanup failed', err);
    }
  }
}
