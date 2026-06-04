import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "../infra/prisma/prisma.service";
import { readCount, type CountResult } from "../common/db/bigint";
import {
  AnalyticsEventType,
  type DashboardMetricsDto,
  type EntityAnalyticsDto,
  type RecordEventDto,
} from "./dto";

const SLOT_COUNT = 20;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type EntityEventMetrics = Pick<EntityAnalyticsDto, "uniqueViewers" | "last7Days" | "last30Days">;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(
    dto: RecordEventDto,
    userId: string | null,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    const slot = Math.floor(Math.random() * SLOT_COUNT);

    await this.writeEventAsync(dto, userId, ipHash, userAgent, slot);
  }

  private async writeEventAsync(
    dto: RecordEventDto,
    userId: string | null,
    ipHash: string,
    userAgent: string,
    slot: number,
  ): Promise<void> {
    // Wrap event row insert + counter upsert in a transaction to prevent drift
    await this.prisma.$transaction(async (tx) => {
      switch (dto.eventType) {
        case AnalyticsEventType.PROFILE_VIEW:
          await tx.profileView.create({
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
          await tx.companyView.create({
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
          await tx.postImpression.create({
            data: {
              postId: dto.targetId,
              userId,
              ipHash,
              source: dto.source,
            },
          });
          break;
      }

      await tx.$executeRaw`
        INSERT INTO slotted_counters (entity_type, entity_id, slot, count)
        VALUES (${dto.eventType}, ${dto.targetId}::uuid, ${slot}, 1)
        ON CONFLICT (entity_type, entity_id, slot)
        DO UPDATE SET count = slotted_counters.count + 1, updated_at = now()
      `;
    });
  }

  async getEntityAnalytics(entityType: string, entityId: string): Promise<EntityAnalyticsDto> {
    const [totalResult, eventMetrics] = await Promise.all([
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT SUM(count) as total
        FROM slotted_counters
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}::uuid
      `,
      this.getEntityEventMetrics(entityType, entityId),
    ]);

    const totalViews = totalResult[0]?.total ? Number(totalResult[0].total) : 0;

    return {
      totalViews,
      ...eventMetrics,
    };
  }

  private async getEntityEventMetrics(
    entityType: string,
    entityId: string,
  ): Promise<EntityEventMetrics> {
    const now = Date.now();
    const since7Days = new Date(now - SEVEN_DAYS_MS);
    const since30Days = new Date(now - THIRTY_DAYS_MS);

    switch (entityType) {
      case "profile_view":
        return this.getProfileViewMetrics(entityId, since7Days, since30Days);
      case "company_view":
        return this.getCompanyViewMetrics(entityId, since7Days, since30Days);
      case "post_impression":
        return this.getPostImpressionMetrics(entityId, since7Days, since30Days);
      default:
        this.logger.warn(`Unknown entity type: ${entityType}`);
        return { uniqueViewers: 0, last7Days: 0, last30Days: 0 };
    }
  }

  private async getProfileViewMetrics(
    profileId: string,
    since7Days: Date,
    since30Days: Date,
  ): Promise<EntityEventMetrics> {
    const [uniqueViewers, last7Days, last30Days] = await Promise.all([
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM profile_views
        WHERE profile_id = ${profileId}::uuid
          AND created_at >= ${since30Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM profile_views
        WHERE profile_id = ${profileId}::uuid
          AND created_at >= ${since7Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM profile_views
        WHERE profile_id = ${profileId}::uuid
          AND created_at >= ${since30Days}
      `,
    ]);

    return {
      uniqueViewers: readCount(uniqueViewers),
      last7Days: readCount(last7Days),
      last30Days: readCount(last30Days),
    };
  }

  private async getCompanyViewMetrics(
    companyId: string,
    since7Days: Date,
    since30Days: Date,
  ): Promise<EntityEventMetrics> {
    const [uniqueViewers, last7Days, last30Days] = await Promise.all([
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM company_views
        WHERE company_id = ${companyId}::uuid
          AND created_at >= ${since30Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM company_views
        WHERE company_id = ${companyId}::uuid
          AND created_at >= ${since7Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM company_views
        WHERE company_id = ${companyId}::uuid
          AND created_at >= ${since30Days}
      `,
    ]);

    return {
      uniqueViewers: readCount(uniqueViewers),
      last7Days: readCount(last7Days),
      last30Days: readCount(last30Days),
    };
  }

  private async getPostImpressionMetrics(
    postId: string,
    since7Days: Date,
    since30Days: Date,
  ): Promise<EntityEventMetrics> {
    const [uniqueViewers, last7Days, last30Days] = await Promise.all([
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM post_impressions
        WHERE post_id = ${postId}::uuid
          AND created_at >= ${since30Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM post_impressions
        WHERE post_id = ${postId}::uuid
          AND created_at >= ${since7Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM post_impressions
        WHERE post_id = ${postId}::uuid
          AND created_at >= ${since30Days}
      `,
    ]);

    return {
      uniqueViewers: readCount(uniqueViewers),
      last7Days: readCount(last7Days),
      last30Days: readCount(last30Days),
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
