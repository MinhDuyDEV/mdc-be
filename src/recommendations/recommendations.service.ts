import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { PrismaService } from '../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../infra/redis/redis.constants';
import type {
  RecommendationsResponseDto,
  RecommendedCompanyDto,
  RecommendedJobDto,
  RecommendedPersonDto,
} from './dto';
import {
  encodeScoreCursor,
  paginateScored,
  type RecommendationsRepository,
} from './recommendations.repository';

@Injectable()
export class RecommendationsService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'recommendations:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: RecommendationsRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getPeopleRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<RecommendationsResponseDto<RecommendedPersonDto>> {
    // Cache only the first page (no cursor) — the most frequently hit.
    // Caching per-cursor would produce near-zero cache hit rates since
    // every paginated page has a unique cursor.
    const shouldCache = !cursor;
    const cacheKey = `${this.CACHE_PREFIX}people:${userId}`;

    if (shouldCache) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(
            cached,
          ) as RecommendationsResponseDto<RecommendedPersonDto>;
        }
      } catch {
        // Redis unavailable, continue without cache
      }
    }

    const scoredIds = await this.repository.findPeopleRecommendations(
      userId,
      cursor,
      limit,
    );

    if (scoredIds.length === 0) {
      const emptyResult: RecommendationsResponseDto<RecommendedPersonDto> = {
        data: [],
        meta: { hasNextPage: false, limit },
      };
      if (shouldCache) {
        try {
          await this.redis.setex(
            cacheKey,
            this.CACHE_TTL,
            JSON.stringify(emptyResult),
          );
        } catch {
          // Ignore cache write failure
        }
      }
      return emptyResult;
    }

    // Detect hasNextPage before enrichment to avoid enriching the sentinel row
    const hasNextPage = scoredIds.length > limit;
    const idsToEnrich = hasNextPage
      ? scoredIds.slice(0, limit).map((r) => r.id)
      : scoredIds.map((r) => r.id);

    const users = await this.prisma.user.findMany({
      where: { id: { in: idsToEnrich } },
      select: {
        id: true,
        displayName: true,
        profile: {
          select: {
            headline: true,
            location: true,
          },
        },
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const enriched: Array<RecommendedPersonDto & { score: number }> = [];
    for (const scored of scoredIds) {
      // Only process items within limit (skip sentinel row)
      if (enriched.length >= limit) break;
      const user = userMap.get(scored.id);
      if (!user) continue;
      enriched.push({
        id: user.id,
        displayName: user.displayName,
        headline: user.profile?.headline || null,
        location: user.profile?.location || null,
        profilePictureUrl: null, // TODO: populate when user avatar field is available
        score: scored.score,
      });
    }

    const paginated = paginateScored(enriched, limit);

    // paginateScored cannot detect hasNextPage since we pre-sliced scoredIds;
    // use the pre-computed flag from scoredIds.length. Also compute nextCursor
    // manually since paginateScored's internal hasNextPage is always false here.
    const lastItem = enriched.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? encodeScoreCursor(lastItem.score, lastItem.id)
        : undefined;
    // Strip internal score from response data
    const cleanData: RecommendedPersonDto[] = paginated.data.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ score, ...rest }) => rest,
    );
    const result: RecommendationsResponseDto<RecommendedPersonDto> = {
      data: cleanData,
      meta: { nextCursor, hasNextPage, limit },
    };

    if (shouldCache) {
      try {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(result),
        );
      } catch {
        // Ignore cache write failure
      }
    }

    // NOTE: Returns { data, meta } directly — the global ApiResponseInterceptor
    // recognizes this shape via isApiSuccessResponse() and passes it through without
    // double-wrapping. This is consistent with the interceptor's bypass logic.
    return result;
  }

  async getJobRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<RecommendationsResponseDto<RecommendedJobDto>> {
    // Only job recommendations respect the notification preference
    // because jobs have clear opt-out semantics (users may not want job alerts).
    // People and company recommendations are always on — they're core to the
    // networking experience and don't have an equivalent preference field.
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: { jobRecommendation: true },
    });

    if (preference && !preference.jobRecommendation) {
      return { data: [], meta: { hasNextPage: false, limit } };
    }

    const shouldCache = !cursor;
    const cacheKey = `${this.CACHE_PREFIX}jobs:${userId}`;

    if (shouldCache) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(
            cached,
          ) as RecommendationsResponseDto<RecommendedJobDto>;
        }
      } catch {
        // Continue without cache
      }
    }

    const scoredIds = await this.repository.findJobRecommendations(
      userId,
      cursor,
      limit,
    );

    if (scoredIds.length === 0) {
      const emptyResult: RecommendationsResponseDto<RecommendedJobDto> = {
        data: [],
        meta: { hasNextPage: false, limit },
      };
      if (shouldCache) {
        try {
          await this.redis.setex(
            cacheKey,
            this.CACHE_TTL,
            JSON.stringify(emptyResult),
          );
        } catch {
          // Ignore
        }
      }
      return emptyResult;
    }

    const hasNextPage = scoredIds.length > limit;
    const idsToEnrich = hasNextPage
      ? scoredIds.slice(0, limit).map((r) => r.id)
      : scoredIds.map((r) => r.id);

    const jobs = await this.prisma.job.findMany({
      where: { id: { in: idsToEnrich } },
      select: {
        id: true,
        title: true,
        location: true,
        employmentType: true,
        workplaceType: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        publishedAt: true,
        company: { select: { name: true } },
      },
    });

    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const enriched: Array<RecommendedJobDto & { score: number }> = [];
    for (const scored of scoredIds) {
      if (enriched.length >= limit) break;
      const job = jobMap.get(scored.id);
      if (!job) continue;
      enriched.push({
        id: job.id,
        title: job.title,
        companyName: job.company.name,
        location: job.location,
        employmentType: job.employmentType,
        workplaceType: job.workplaceType,
        salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
        salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
        salaryCurrency: job.salaryCurrency,
        publishedAt: job.publishedAt,
        score: scored.score,
      });
    }

    const paginated = paginateScored(enriched, limit);

    const lastItem = enriched.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? encodeScoreCursor(lastItem.score, lastItem.id)
        : undefined;
    const cleanData: RecommendedJobDto[] = paginated.data.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ score, ...rest }) => rest,
    );
    const result: RecommendationsResponseDto<RecommendedJobDto> = {
      data: cleanData,
      meta: { nextCursor, hasNextPage, limit },
    };

    if (shouldCache) {
      try {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(result),
        );
      } catch {
        // Ignore
      }
    }

    return result;
  }

  async getCompanyRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<RecommendationsResponseDto<RecommendedCompanyDto>> {
    const shouldCache = !cursor;
    const cacheKey = `${this.CACHE_PREFIX}companies:${userId}`;

    if (shouldCache) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(
            cached,
          ) as RecommendationsResponseDto<RecommendedCompanyDto>;
        }
      } catch {
        // Continue without cache
      }
    }

    const scoredIds = await this.repository.findCompanyRecommendations(
      userId,
      cursor,
      limit,
    );

    if (scoredIds.length === 0) {
      const emptyResult: RecommendationsResponseDto<RecommendedCompanyDto> = {
        data: [],
        meta: { hasNextPage: false, limit },
      };
      if (shouldCache) {
        try {
          await this.redis.setex(
            cacheKey,
            this.CACHE_TTL,
            JSON.stringify(emptyResult),
          );
        } catch {
          // Ignore
        }
      }
      return emptyResult;
    }

    const hasNextPage = scoredIds.length > limit;
    const idsToEnrich = hasNextPage
      ? scoredIds.slice(0, limit).map((r) => r.id)
      : scoredIds.map((r) => r.id);

    const companies = await this.prisma.company.findMany({
      where: { id: { in: idsToEnrich } },
      select: {
        id: true,
        name: true,
        industry: true,
        followerCount: true,
        verified: true,
      },
    });

    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const enriched: Array<RecommendedCompanyDto & { score: number }> = [];
    for (const scored of scoredIds) {
      if (enriched.length >= limit) break;
      const company = companyMap.get(scored.id);
      if (!company) continue;
      enriched.push({
        id: company.id,
        name: company.name,
        industry: company.industry,
        followerCount: company.followerCount,
        verified: company.verified,
        logoUrl: null, // TODO: populate when company logo field is available
        score: scored.score,
      });
    }

    const paginated = paginateScored(enriched, limit);

    const lastItem = enriched.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? encodeScoreCursor(lastItem.score, lastItem.id)
        : undefined;
    const cleanData: RecommendedCompanyDto[] = paginated.data.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ score, ...rest }) => rest,
    );
    const result: RecommendationsResponseDto<RecommendedCompanyDto> = {
      data: cleanData,
      meta: { nextCursor, hasNextPage, limit },
    };

    if (shouldCache) {
      try {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(result),
        );
      } catch {
        // Ignore
      }
    }

    return result;
  }
}
