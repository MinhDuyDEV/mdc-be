import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../infra/prisma/prisma.service';
import { LeaderLockService } from '../infra/scheduling/leader-lock.service';
import { OutboxService } from '../outbox/outbox.service';

/**
 * Daily SLA monitor. Emits a `DeletionSlaBreached` outbox event for any
 * DeletionRequest whose 30-day SLA deadline has passed without completion.
 * Downstream consumers (alerting, admin notification) subscribe to that event.
 *
 * Important: this service does NOT call `anonymizeUser` itself. The
 * grace-expiry processor (`gdpr-grace-expiry.processor.ts`) is the only
 * path that drives the actual anonymization, on a 5-minute cadence after
 * the 7-day grace window.
 */
@Injectable()
export class GdprSlaMonitorService {
  private readonly logger = new Logger(GdprSlaMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderLock: LeaderLockService,
    private readonly outboxService: OutboxService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'gdpr-sla-monitor',
    waitForCompletion: true,
  })
  async checkSla(): Promise<void> {
    await this.leaderLock.runIfLeader('gdpr-sla-monitor', 60_000, async () => {
      const overdue = await this.prisma.deletionRequest.findMany({
        where: {
          dueBy: { lt: new Date() },
          status: { in: ['PENDING_ERASURE', 'IN_PROGRESS', 'FAILED'] },
        },
        select: { id: true, userId: true, dueBy: true, status: true },
      });

      for (const request of overdue) {
        this.logger.warn(
          `GDPR SLA overdue: request ${request.id} for user ${request.userId} due ${request.dueBy.toISOString()}`,
        );
        // Emit a breach event for downstream alerting. The transaction
        // here is just for the outbox row; no domain data is being written.
        try {
          await this.prisma.$transaction(async (tx) => {
            await this.outboxService.emit(tx, {
              eventType: 'DeletionSlaBreached',
              aggregateType: 'DeletionRequest',
              aggregateId: request.id,
              payload: {
                requestId: request.id,
                userId: request.userId,
                dueBy: request.dueBy.toISOString(),
                status: request.status,
              },
            });
          });
        } catch (err) {
          this.logger.error(
            `Failed to emit DeletionSlaBreached for request ${request.id}: ${String(err)}`,
          );
        }
      }
    });
  }
}
