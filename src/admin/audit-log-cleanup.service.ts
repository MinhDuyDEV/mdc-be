import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { LeaderLockService } from '../infra/scheduling/leader-lock.service';
import type { PrismaService } from '../infra/prisma/prisma.service';

const RETENTION_DAYS = 90;
const LEADER_LOCK_TTL_MS = 300_000;

@Injectable()
export class AuditLogCleanupService {
  private readonly logger = new Logger(AuditLogCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  /**
   * Public entry point. Exposed for tests and ad-hoc admin triggers; the
   * scheduled job delegates here. Wraps the destructive work in the shared
   * leader lock so only one worker instance runs the cleanup at a time.
   */
  async purge(): Promise<void> {
    await this.leaderLock.runIfLeader(
      'audit-log-cleanup',
      LEADER_LOCK_TTL_MS,
      async () => {
        const cutoff = this.computeCutoff();
        const result = await this.prisma.auditLog.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        this.logger.log(
          `Purged ${result.count} audit log rows older than ${cutoff.toISOString()}`,
        );
      },
    );
  }

  /**
   * Daily schedule at 03:17 server time. Time chosen to avoid overlap
   * with the outbox dispatcher and other periodic jobs.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  scheduledPurge(): void {
    // Errors are swallowed by the leader lock and logged internally; the
    // cron registration is best-effort.
    void this.purge().catch((err) => {
      this.logger.error('Scheduled audit log cleanup failed', err);
    });
  }

  private computeCutoff(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    return cutoff;
  }
}
