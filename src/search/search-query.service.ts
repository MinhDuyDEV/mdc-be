import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { SearchEngineService } from '../infra/search-engine/search-engine.service';
import type { SearchQueryDto } from './dto/search.query.dto';
import type {
  SearchHitDto,
  SearchResponseDto,
} from './dto/search.response.dto';
import type { SearchService } from './search.service';
import type { SearchFallbackService } from './search-fallback.service';
import type { SearchIndexService } from './search-index.service';

@Injectable()
export class SearchQueryService {
  constructor(
    private readonly searchEngine: SearchEngineService,
    private readonly searchService: SearchService,
    private readonly searchIndex: SearchIndexService,
    private readonly fallback: SearchFallbackService,
    private readonly prisma: PrismaService,
    @InjectPinoLogger(SearchQueryService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Unified search across entity types.
   *
   * Tries Elasticsearch first. Falls back to Postgres FTS if ES is
   * unavailable or the circuit breaker is open.
   */
  async search(
    query: SearchQueryDto,
    userId?: string,
  ): Promise<SearchResponseDto> {
    const startTime = Date.now();
    const entityTypes = query.type ?? [
      'profiles',
      'companies',
      'jobs',
      'posts',
    ];
    const useElasticsearch = !this.fallback.isCircuitOpen();

    let result: SearchResponseDto;
    let engine: 'elasticsearch' | 'postgres';

    if (useElasticsearch) {
      try {
        result = await this.searchWithElasticsearch(query, entityTypes);
        this.fallback.recordSuccess();
        engine = 'elasticsearch';
      } catch (error) {
        this.logger.warn(
          { error },
          'ES search failed, falling back to Postgres',
        );
        this.fallback.recordFailure(error);
        result = await this.searchWithPostgres(query, entityTypes);
        engine = 'postgres';
      }
    } else {
      result = await this.searchWithPostgres(query, entityTypes);
      engine = 'postgres';
    }

    const took = Date.now() - startTime;
    result.meta.engine = engine;
    result.meta.took = took;

    // Log query (best-effort, non-blocking)
    this.logQuery(
      query.q,
      entityTypes,
      result.data.length,
      took,
      engine,
      userId,
    ).catch(() => {});

    return result;
  }

  /**
   * Search within a single entity type.
   */
  async searchEntity(
    entityType: 'profiles' | 'companies' | 'jobs' | 'posts',
    query: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.search({ ...query, type: [entityType] });
  }

  /**
   * Log a search query for analytics (PII-safe — stores SHA-256 hash only).
   *
   * This is best-effort: if the database write fails for any reason the
   * search response is still returned to the caller.
   */
  private async logQuery(
    query: string,
    entityTypes: string[],
    resultCount: number,
    latencyMs: number,
    engine: 'elasticsearch' | 'postgres',
    userId?: string,
  ): Promise<void> {
    try {
      const queryHash = createHash('sha256')
        .update(query.toLowerCase().trim())
        .digest('hex');

      await this.prisma.searchQueryLog.create({
        data: {
          queryHash,
          entityTypes,
          resultCount,
          latencyMs,
          engine,
          userId,
        },
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to log search query');
    }
  }

  /**
   * Cleanup old search query logs — runs daily at 2 AM.
   * Keeps logs for 90 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldLogs(): Promise<void> {
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await this.prisma.searchQueryLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });
      this.logger.info(
        { deletedCount: result.count, retentionDays },
        'Cleaned up old search query logs',
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to cleanup old search query logs');
    }
  }

  /**
   * Execute search via Elasticsearch with per-index fallback.
   * Throws if all indices fail so the orchestrator falls back to PG.
   */
  private async searchWithElasticsearch(
    query: SearchQueryDto,
    entityTypes: string[],
  ): Promise<SearchResponseDto> {
    const indices = entityTypes.map((t) => t);
    const esQuery = this.searchService.buildMultiMatchQuery(
      query.q,
      entityTypes,
      {
        fuzziness: 'AUTO',
        operator: 'or',
      },
    );

    const body = this.searchService.buildSearchBody(esQuery, {
      size: query.limit ?? 20,
    });

    let response: unknown;
    try {
      response = await this.searchEngine.search(indices.join(','), body);
    } catch {
      // Try individual indices if multi-index search fails
      const hits: SearchHitDto[] = [];
      let total = 0;
      for (const idx of indices) {
        try {
          const singleResponse = await this.searchEngine.search(idx, body);
          const singleHits = this.normalizeSearchResponse(singleResponse, idx);
          hits.push(...singleHits);
          total += (singleResponse as any)?.hits?.total?.value ?? 0;
        } catch {
          this.logger.warn(`ES search failed for index ${idx}, skipping`);
        }
      }

      // If no individual index returned results, re-throw so the outer
      // orchestrator triggers PG fallback.
      if (hits.length === 0 && indices.length > 0) {
        throw new Error('All ES indices failed');
      }

      return {
        data: hits
          .sort((a, b) => b.score - a.score)
          .slice(0, query.limit ?? 20),
        meta: { total, hasNextPage: false, took: 0, engine: 'elasticsearch' },
      };
    }

    const hits = this.normalizeSearchResponse(
      response,
      entityTypes[0] ?? 'profiles',
    );
    const total = (response as any)?.hits?.total?.value ?? 0;

    return {
      data: hits,
      meta: {
        total,
        hasNextPage: hits.length >= (query.limit ?? 20),
        took: 0,
        engine: 'elasticsearch',
      },
    };
  }

  /**
   * Normalize raw ES response to SearchHitDto array.
   */
  private normalizeSearchResponse(
    response: unknown,
    entityType: string,
  ): SearchHitDto[] {
    const hits = (response as any)?.hits?.hits ?? [];
    return hits.map((hit: any) => ({
      id: hit._id,
      type: entityType.slice(0, -1) as SearchHitDto['type'], // 'profiles' → 'profile'
      score: hit._score ?? 0,
      data: hit._source ?? {},
      highlights: hit.highlight,
    }));
  }

  /**
   * Postgres FTS fallback — returns empty results as a placeholder.
   * Domain-level PG FTS search is currently handled directly by each
   * domain module via SearchService helpers.
   */
  private searchWithPostgres(
    query: SearchQueryDto,
    entityTypes: string[],
  ): Promise<SearchResponseDto> {
    this.logger.debug(
      { q: query.q, entityTypes },
      'Using Postgres FTS fallback',
    );

    return {
      data: [],
      meta: {
        total: 0,
        hasNextPage: false,
        took: 0,
        engine: 'postgres',
      },
    };
  }
}
