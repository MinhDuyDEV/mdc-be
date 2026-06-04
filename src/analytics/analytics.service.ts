import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { Prisma } from "@prisma/client";
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

type EventWriteArgs = {
  targetId: string;
  userId: string | null;
  ipHash: string;
  userAgent: string;
  source?: string;
};

/**
 * Per-entity-type persistence configuration.
 *
 * The `eventTable` and `entityIdColumn` strings are *hardcoded constants*
 * (never user input) and are safe to pass through `Prisma.raw()` for
 * identifier interpolation.
 */
interface EntityConfig {
  readonly eventTable: string;
  readonly entityIdColumn: string;
  /**
   * Insert one event row into the Prisma model that corresponds to this
   * entity type.
   */
  readonly writeEvent: (tx: Prisma.TransactionClient, args: EventWriteArgs) => Promise<unknown>;
}

/**
 * Typed map from `AnalyticsEventType` → its persistence configuration.
 *
 * Adding a new value to `AnalyticsEventType` causes a **compile-time** error
 * because this `Record` literal will miss the new key. The old `switch`
 * silently fell through to the `default: return zeros` branch on a typo
 * (`'profile_views'` vs `'profile_view'`) — that class of bug is now
 * structurally impossible.
 */
const ENTITY_CONFIGS: Record<AnalyticsEventType, EntityConfig> = {
  [AnalyticsEventType.PROFILE_VIEW]: {
    eventTable: "profile_views",
    entityIdColumn: "profile_id",
    writeEvent: (tx, { targetId, userId, ipHash, userAgent, source }) =>
      tx.profileView.create({
        data: { profileId: targetId, userId, ipHash, userAgent, source },
      }),
  },
  [AnalyticsEventType.COMPANY_VIEW]: {
    eventTable: "company_views",
    entityIdColumn: "company_id",
    writeEvent: (tx, { targetId, userId, ipHash, userAgent, source }) =>
      tx.companyView.create({
        data: { companyId: targetId, userId, ipHash, userAgent, source },
      }),
  },
  [AnalyticsEventType.POST_IMPRESSION]: {
    eventTable: "post_impressions",
    entityIdColumn: "post_id",
    writeEvent: (tx, { targetId, userId, ipHash, source }) =>
      tx.postImpression.create({
        data: { postId: targetId, userId, ipHash, source },
      }),
  },
};

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
    const config = ENTITY_CONFIGS[dto.eventType];
    const writeArgs: EventWriteArgs = {
      targetId: dto.targetId,
      userId,
      ipHash,
      userAgent,
      ...(dto.source !== undefined ? { source: dto.source } : {}),
    };

    // Wrap event row insert + counter upsert in a transaction to prevent drift
    await this.prisma.$transaction(async (tx) => {
      await config.writeEvent(tx, writeArgs);
      await tx.$executeRaw`
        INSERT INTO slotted_counters (entity_type, entity_id, slot, count)
        VALUES (${dto.eventType}, ${dto.targetId}::uuid, ${slot}, 1)
        ON CONFLICT (entity_type, entity_id, slot)
        DO UPDATE SET count = slotted_counters.count + 1, updated_at = now()
      `;
    });
  }

  async getEntityAnalytics(
    entityType: AnalyticsEventType,
    entityId: string,
  ): Promise<EntityAnalyticsDto> {
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

  /**
   * Fetch the (uniqueViewers, last7Days, last30Days) triple for the given
   * entity type. Replaces the three near-identical `get*Metrics` methods
   * that previously existed for profile / company / post entities.
   */
  private async getEntityEventMetrics(
    entityType: AnalyticsEventType,
    entityId: string,
  ): Promise<EntityEventMetrics> {
    const config = ENTITY_CONFIGS[entityType];
    const now = Date.now();
    const since7Days = new Date(now - SEVEN_DAYS_MS);
    const since30Days = new Date(now - THIRTY_DAYS_MS);

    // Prisma.raw is safe here: both arguments are hardcoded constants from
    // ENTITY_CONFIGS, never user input.
    const table = Prisma.raw(config.eventTable);
    const idCol = Prisma.raw(config.entityIdColumn);

    const [uniqueViewers, last7Days, last30Days] = await Promise.all([
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM ${table}
        WHERE ${idCol} = ${entityId}::uuid
          AND created_at >= ${since30Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM ${table}
        WHERE ${idCol} = ${entityId}::uuid
          AND created_at >= ${since7Days}
      `,
      this.prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS count
        FROM ${table}
        WHERE ${idCol} = ${entityId}::uuid
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
