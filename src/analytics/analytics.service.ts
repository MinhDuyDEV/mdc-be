import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { PrismaService } from '../infra/prisma/prisma.service';
import {
  AnalyticsEventType,
  type DashboardMetricsDto,
  type EntityAnalyticsDto,
  type RecordEventDto,
} from './dto';

const SLOT_COUNT = 20;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  recordEvent(
    dto: RecordEventDto,
    userId: string | null,
    ip: string,
    userAgent: string,
  ): void {
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const slot = Math.floor(Math.random() * SLOT_COUNT);

    // Fire-and-forget — do not await
    void this.writeEventAsync(dto, userId, ipHash, userAgent, slot);
  }

  private async writeEventAsync(
    dto: RecordEventDto,
    userId: string | null,
    ipHash: string,
    userAgent: string,
    slot: number,
  ): Promise<void> {
    try {
      switch (dto.eventType) {
        case AnalyticsEventType.PROFILE_VIEW:
          await this.prisma.profileView.create({
            data: {
              profileId: dto.targetId,
              userId,
              ipHash,
              userAgent,
              source: dto.source,
            },
          });
          break;
        case AnalyticsEventType.COMPANY_VIEW:
          await this.prisma.companyView.create({
            data: {
              companyId: dto.targetId,
              userId,
              ipHash,
              userAgent,
              source: dto.source,
            },
          });
          break;
        case AnalyticsEventType.POST_IMPRESSION:
          await this.prisma.postImpression.create({
            data: {
              postId: dto.targetId,
              userId,
              ipHash,
              source: dto.source,
            },
          });
          break;
      }

      await this.prisma.$executeRaw`
        INSERT INTO slotted_counters (entity_type, entity_id, slot, count)
        VALUES (${dto.eventType}, ${dto.targetId}::uuid, ${slot}, 1)
        ON CONFLICT (entity_type, entity_id, slot)
        DO UPDATE SET count = slotted_counters.count + 1, updated_at = now()
      `;
    } catch (error) {
      console.error('Analytics write failed:', error);
    }
  }

  async getEntityAnalytics(
    entityType: string,
    entityId: string,
  ): Promise<EntityAnalyticsDto> {
    const result = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT SUM(count) as total
      FROM slotted_counters
      WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}::uuid
    `;

    const totalViews = result[0]?.total ? Number(result[0].total) : 0;

    return {
      totalViews,
      uniqueViewers: null,
      last7Days: null,
      last30Days: null,
    };
  }

  async getDashboardMetrics(): Promise<DashboardMetricsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [users, posts, jobs, applications, reports] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.post.count({ where: { createdAt: { gte: today } } }),
      this.prisma.job.count({ where: { createdAt: { gte: today } } }),
      this.prisma.application.count({ where: { submittedAt: { gte: today } } }),
      this.prisma.report.count({ where: { createdAt: { gte: today } } }),
    ]);

    return {
      dailyNewUsers: users,
      dailyNewPosts: posts,
      dailyNewJobs: jobs,
      dailyApplications: applications,
      dailyReports: reports,
    };
  }
}
