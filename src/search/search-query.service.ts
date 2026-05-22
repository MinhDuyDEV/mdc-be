import type { estypes } from '@elastic/elasticsearch';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../infra/prisma/prisma.service';
import { SearchEngineService } from '../infra/search-engine/search-engine.service';
import type { SearchQueryDto } from './dto/search.query.dto';
import type {
  SearchHitDto,
  SearchResponseDto,
} from './dto/search.response.dto';
import { SearchService } from './search.service';
import { SearchFallbackService } from './search-fallback.service';

type EsSearchHit = estypes.SearchHit<Record<string, unknown>>;
type EsSearchResponse = estypes.SearchResponse<Record<string, unknown>>;

const ENTITY_TYPE_MAP: Record<string, SearchHitDto['type']> = {
  profiles: 'profile',
  companies: 'company',
  jobs: 'job',
  posts: 'post',
};

@Injectable()
export class SearchQueryService {
  constructor(
    private readonly searchEngine: SearchEngineService,
    private readonly searchService: SearchService,
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
          { error: String(error) },
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
      this.logger.warn({ error: String(error) }, 'Failed to log search query');
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
      this.logger.error(
        { error: String(error) },
        'Failed to cleanup old search query logs',
      );
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

    let response: EsSearchResponse | undefined;
    try {
      response = (await this.searchEngine.search(
        indices.join(','),
        body,
      )) as EsSearchResponse;
    } catch {
      // Try individual indices if multi-index search fails
      const hits: SearchHitDto[] = [];
      let total = 0;
      for (const idx of indices) {
        try {
          const singleResponse = (await this.searchEngine.search(
            idx,
            body,
          )) as EsSearchResponse;
          const singleHits = this.normalizeSearchResponse(singleResponse, idx);
          hits.push(...singleHits);
          total +=
            (singleResponse.hits.total as estypes.SearchTotalHits)?.value ?? 0;
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
    const total = (response.hits.total as estypes.SearchTotalHits)?.value ?? 0;

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
    response: EsSearchResponse,
    entityType: string,
  ): SearchHitDto[] {
    const hits: EsSearchHit[] = response.hits.hits;
    return hits.map((hit) => ({
      id: hit._id ?? '',
      type: ENTITY_TYPE_MAP[entityType] ?? 'profile',
      score: hit._score ?? 0,
      data: hit._source ?? {},
      highlights: hit.highlight,
    }));
  }

  /**
   * Postgres FTS fallback using ts_rank + ts_query @@ ts_vector.
   * Queries each entity table independently and merges results by rank.
   */
  private async searchWithPostgres(
    query: SearchQueryDto,
    entityTypes: string[],
  ): Promise<SearchResponseDto> {
    this.logger.debug(
      { q: query.q, entityTypes },
      'Using Postgres FTS fallback',
    );

    const tsQuery = this.searchService.toTsQuery(query.q);
    if (!tsQuery) {
      return {
        data: [],
        meta: { total: 0, hasNextPage: false, took: 0, engine: 'postgres' },
      };
    }

    const limit = query.limit ?? 20;
    const allHits: SearchHitDto[] = [];

    for (const entityType of entityTypes) {
      try {
        const hits = await this.searchEntityWithPostgres(
          entityType,
          tsQuery,
          limit,
        );
        allHits.push(...hits);
      } catch (error) {
        this.logger.warn(
          { error: String(error), entityType },
          'PG FTS search failed for entity type, skipping',
        );
      }
    }

    // Sort by rank descending, then slice to limit
    allHits.sort((a, b) => b.score - a.score);
    const sliced = allHits.slice(0, limit);

    return {
      data: sliced,
      meta: {
        total: allHits.length,
        hasNextPage: allHits.length > limit,
        took: 0,
        engine: 'postgres',
      },
    };
  }

  /**
   * Search a single entity type via Postgres FTS.
   */
  private async searchEntityWithPostgres(
    entityType: string,
    tsQuery: string,
    limit: number,
  ): Promise<SearchHitDto[]> {
    switch (entityType) {
      case 'profiles':
        return this.searchProfilesWithPostgres(tsQuery, limit);
      case 'companies':
        return this.searchCompaniesWithPostgres(tsQuery, limit);
      case 'jobs':
        return this.searchJobsWithPostgres(tsQuery, limit);
      case 'posts':
        return this.searchPostsWithPostgres(tsQuery, limit);
      default:
        return [];
    }
  }

  private async searchProfilesWithPostgres(
    tsQuery: string,
    limit: number,
  ): Promise<SearchHitDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        display_name: string | null;
        headline: string | null;
        about: string | null;
        location: string | null;
        rank: number;
      }>
    >(
      Prisma.sql`SELECT
        p.id,
        u.display_name,
        p.headline,
        p.about,
        p.location,
        ts_rank(p.search_vector, plainto_tsquery('english', ${tsQuery})) AS rank
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.search_vector @@ plainto_tsquery('english', ${tsQuery})
        AND p.visibility = 'PUBLIC'
      ORDER BY rank DESC
      LIMIT ${limit}`,
    );

    return rows.map((row) => ({
      id: row.id,
      type: 'profile' as const,
      score: row.rank,
      data: {
        displayName: row.display_name,
        headline: row.headline,
        about: row.about,
        location: row.location,
      },
    }));
  }

  private async searchCompaniesWithPostgres(
    tsQuery: string,
    limit: number,
  ): Promise<SearchHitDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        industry: string | null;
        description: string | null;
        headquarters: string | null;
        rank: number;
      }>
    >(
      Prisma.sql`SELECT
        id,
        name,
        industry::text,
        description,
        headquarters,
        ts_rank(search_vector, plainto_tsquery('english', ${tsQuery})) AS rank
      FROM companies
      WHERE search_vector @@ plainto_tsquery('english', ${tsQuery})
        AND deleted_at IS NULL
      ORDER BY rank DESC
      LIMIT ${limit}`,
    );

    return rows.map((row) => ({
      id: row.id,
      type: 'company' as const,
      score: row.rank,
      data: {
        name: row.name,
        industry: row.industry,
        description: row.description,
        location: row.headquarters,
      },
    }));
  }

  private async searchJobsWithPostgres(
    tsQuery: string,
    limit: number,
  ): Promise<SearchHitDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        location: string | null;
        company_name: string | null;
        rank: number;
      }>
    >(
      Prisma.sql`SELECT
        j.id,
        j.title,
        j.description,
        j.location,
        c.name AS company_name,
        ts_rank(j.search_vector, plainto_tsquery('english', ${tsQuery})) AS rank
      FROM jobs j
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE j.search_vector @@ plainto_tsquery('english', ${tsQuery})
        AND j.deleted_at IS NULL
        AND j.status = 'PUBLISHED'
      ORDER BY rank DESC
      LIMIT ${limit}`,
    );

    return rows.map((row) => ({
      id: row.id,
      type: 'job' as const,
      score: row.rank,
      data: {
        title: row.title,
        description: row.description,
        location: row.location,
        companyName: row.company_name,
      },
    }));
  }

  private async searchPostsWithPostgres(
    tsQuery: string,
    limit: number,
  ): Promise<SearchHitDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        author_name: string | null;
        rank: number;
      }>
    >(
      Prisma.sql`SELECT
        p.id,
        p.content,
        u.display_name AS author_name,
        ts_rank(p.search_vector, plainto_tsquery('english', ${tsQuery})) AS rank
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.search_vector @@ plainto_tsquery('english', ${tsQuery})
        AND p.deleted_at IS NULL
        AND p.visibility = 'PUBLIC'
        AND p.status = 'PUBLISHED'
      ORDER BY rank DESC
      LIMIT ${limit}`,
    );

    return rows.map((row) => ({
      id: row.id,
      type: 'post' as const,
      score: row.rank,
      data: {
        content: row.content,
        authorName: row.author_name,
      },
    }));
  }
}
