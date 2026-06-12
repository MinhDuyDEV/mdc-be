import type { estypes } from '@elastic/elasticsearch';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SearchEngineService } from '../infra/search-engine/search-engine.service';
import type {
  SuggestHitDto,
  SuggestResponseDto,
} from './dto/search-suggest.dto';
import { SearchService } from './search.service';

type EsSearchHit = estypes.SearchHit<Record<string, unknown>>;
type EsSearchResponse = estypes.SearchResponse<Record<string, unknown>>;

const ENTITY_TYPE_MAP: Record<string, SuggestHitDto['type']> = {
  profiles: 'profile',
  companies: 'company',
  jobs: 'job',
  posts: 'post',
};

const ENTITY_INDICES: Record<string, string> = {
  profiles: 'profiles',
  companies: 'companies',
  jobs: 'jobs',
  posts: 'posts',
};

/**
 * Resolves the most relevant display text from ES hit _source for autocomplete.
 */
function resolveHitText(source: Record<string, unknown>): string {
  return (
    (source.displayName as string) ??
    (source.name as string) ??
    (source.title as string) ??
    (source.companyName as string) ??
    (source.authorName as string) ??
    ''
  );
}

@Injectable()
export class SearchSuggestService {
  constructor(
    @Inject(SearchEngineService)
    private readonly searchEngine: SearchEngineService,
    @Inject(SearchService) private readonly searchService: SearchService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SearchSuggestService.name);
  }

  /**
   * Suggest completions for a partial search query.
   *
   * Runs a multi_match bool_prefix query across all entity types'
   * .autocomplete sub-fields and returns normalized hit objects.
   * Falls back gracefully on ES errors (returns empty result).
   */
  async suggest(
    query: string,
    entityTypes?: string[],
    limit: number = 10,
  ): Promise<SuggestResponseDto> {
    const startTime = Date.now();
    const types = entityTypes ?? ['profiles', 'companies', 'jobs', 'posts'];
    const esQuery = this.searchService.buildAutocompleteQuery(query, types);
    const body = this.searchService.buildSearchBody(esQuery, {
      size: limit,
      _source: ['displayName', 'name', 'title', 'companyName', 'authorName'],
    });

    let took: number;

    try {
      // Build comma-separated index list from entity types (using read aliases)
      const indices = types
        .map((t) => ENTITY_INDICES[t])
        .filter(Boolean)
        .join(',');

      const response = (await this.searchEngine.search(
        indices,
        body,
      )) as EsSearchResponse;

      const hits = this.normalizeResponse(response, types);
      took = Date.now() - startTime;

      // ES query already requests `size: limit`, so `hits` is bounded.
      return {
        data: hits,
        meta: { took },
      };
    } catch (error) {
      took = Date.now() - startTime;
      this.logger.warn(
        { error: String(error), query },
        'Search suggest failed, returning empty results',
      );

      return {
        data: [],
        meta: { took },
      };
    }
  }

  /**
   * Normalize raw ES response to SuggestHitDto array.
   */
  private normalizeResponse(
    response: EsSearchResponse,
    entityTypes: string[],
  ): SuggestHitDto[] {
    const hits: EsSearchHit[] = response.hits.hits;
    if (!hits || hits.length === 0) return [];

    return hits.map((hit) => {
      const source = hit._source ?? {};
      const text = resolveHitText(source);

      // Determine entity type from index name in _index
      const index = hit._index ?? '';
      const type = this.resolveEntityType(index, entityTypes);

      return {
        id: hit._id ?? '',
        type,
        text,
        score: hit._score ?? 0,
      };
    });
  }

  /**
   * Resolve entity type from index name. Falls back to first configured type.
   */
  private resolveEntityType(
    index: string,
    configuredTypes: string[],
  ): SuggestHitDto['type'] {
    // Strip version suffix: "jobs-v1" → "jobs"
    const baseIndex = index.replace(/-v\d+$/, '');
    const mapped = ENTITY_TYPE_MAP[baseIndex];
    if (mapped) return mapped;

    // Fallback to first configured type
    const first = configuredTypes[0] ?? 'profiles';
    return ENTITY_TYPE_MAP[first] ?? 'profile';
  }
}
