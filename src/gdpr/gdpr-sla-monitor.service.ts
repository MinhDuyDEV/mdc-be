import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../infra/prisma/prisma.service';
import { LeaderLockService } from '../infra/scheduling/leader-lock.service';

@Injectable()
export class GdprSlaMonitorService {
  private readonly logger = new Logger(GdprSlaMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkSla(): Promise<void> {
    await this.leaderLock.runIfLeader('gdpr-sla-monitor', 50_000, async () => {
      const overdue = await this.prisma.deletionRequest.findMany({
        where: {
          dueBy: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: { id: true, userId: true, dueBy: true, status: true },
      });

      for (const request of overdue) {
        this.logger.warn(
          `GDPR SLA overdue: request ${request.id} for user ${request.userId} due ${request.dueBy.toISOString()}`,
        );
      }
    });
  }
}
