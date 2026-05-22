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
  type RecommendationsRepository,
} from './recommendations.repository';

@Injectable()
export class RecommendationsService {
  private readonly CACHE_TTL = 300; // 5 minutes
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
    const cacheKey = `${this.CACHE_PREFIX}people:${userId}:${cursor || 'first'}:${limit}`;

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

    const scoredIds = await this.repository.findPeopleRecommendations(
      userId,
      cursor,
      limit,
    );

    if (scoredIds.length === 0) {
      const emptyResult: RecommendationsResponseDto<RecommendedPersonDto> = {
        data: [],
        meta: { hasMore: false, limit },
      };
      try {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(emptyResult),
        );
      } catch {
        // Ignore cache write failure
      }
      return emptyResult;
    }

    const ids = scoredIds.map((r) => r.id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
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
    const enriched: RecommendedPersonDto[] = [];
    for (const scored of scoredIds) {
      const user = userMap.get(scored.id);
      if (!user) continue;
      enriched.push({
        id: user.id,
        displayName: user.displayName,
        headline: user.profile?.headline || null,
        location: user.profile?.location || null,
        profilePictureUrl: null,
        mutualConnectionCount: scored.score,
        score: scored.score,
      });
    }

    const hasMore = scoredIds.length > limit;
    const data = hasMore ? enriched.slice(0, limit) : enriched;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last ? encodeScoreCursor(last.score, last.id) : undefined;

    const result: RecommendationsResponseDto<RecommendedPersonDto> = {
      data,
      meta: { nextCursor, hasMore, limit },
    };

    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    } catch {
      // Ignore cache write failure
    }

    return result;
  }

  async getJobRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<RecommendationsResponseDto<RecommendedJobDto>> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: { jobRecommendation: true },
    });

    if (preference && !preference.jobRecommendation) {
      return { data: [], meta: { hasMore: false, limit } };
    }

    const cacheKey = `${this.CACHE_PREFIX}jobs:${userId}:${cursor || 'first'}:${limit}`;

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

    const scoredIds = await this.repository.findJobRecommendations(
      userId,
      cursor,
      limit,
    );

    if (scoredIds.length === 0) {
      const emptyResult: RecommendationsResponseDto<RecommendedJobDto> = {
        data: [],
        meta: { hasMore: false, limit },
      };
      try {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(emptyResult),
        );
      } catch {
        // Ignore
      }
      return emptyResult;
    }

    const ids = scoredIds.map((r) => r.id);
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: ids } },
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
    const enriched: RecommendedJobDto[] = [];
    for (const scored of scoredIds) {
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

    const hasMore = scoredIds.length > limit;
    const data = hasMore ? enriched.slice(0, limit) : enriched;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last ? encodeScoreCursor(last.score, last.id) : undefined;

    const result: RecommendationsResponseDto<RecommendedJobDto> = {
      data,
      meta: { nextCursor, hasMore, limit },
    };

    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    } catch {
      // Ignore
    }

    return result;
  }

  async getCompanyRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<RecommendationsResponseDto<RecommendedCompanyDto>> {
    const cacheKey = `${this.CACHE_PREFIX}companies:${userId}:${cursor || 'first'}:${limit}`;

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

    const scoredIds = await this.repository.findCompanyRecommendations(
      userId,
      cursor,
      limit,
    );

    if (scoredIds.length === 0) {
      const emptyResult: RecommendationsResponseDto<RecommendedCompanyDto> = {
        data: [],
        meta: { hasMore: false, limit },
      };
      try {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(emptyResult),
        );
      } catch {
        // Ignore
      }
      return emptyResult;
    }

    const ids = scoredIds.map((r) => r.id);
    const companies = await this.prisma.company.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        industry: true,
        followerCount: true,
        verified: true,
      },
    });

    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const enriched: RecommendedCompanyDto[] = [];
    for (const scored of scoredIds) {
      const company = companyMap.get(scored.id);
      if (!company) continue;
      enriched.push({
        id: company.id,
        name: company.name,
        industry: company.industry,
        followerCount: company.followerCount,
        verified: company.verified,
        logoUrl: null,
        score: scored.score,
      });
    }

    const hasMore = scoredIds.length > limit;
    const data = hasMore ? enriched.slice(0, limit) : enriched;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last ? encodeScoreCursor(last.score, last.id) : undefined;

    const result: RecommendationsResponseDto<RecommendedCompanyDto> = {
      data,
      meta: { nextCursor, hasMore, limit },
    };

    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    } catch {
      // Ignore
    }

    return result;
  }
}
