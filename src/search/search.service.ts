import { Injectable } from '@nestjs/common';

const VALID_COLUMN_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Search result from Postgres full-text fallback or Elasticsearch.
 */
export interface SearchResult<T = Record<string, unknown>> {
  items: T[];
  total: number;
}

/**
 * Postgres full-text search query helpers.
 *
 * Provides parameterized query fragments for domain modules to use
 * with Prisma raw queries until Elasticsearch indexing is fully wired.
 */
@Injectable()
export class SearchService {
  /**
   * Build a tsquery parameter for Postgres `plainto_tsquery`.
   */
  toTsQuery(term: string): string {
    const sanitized = term.replace(/['";\\]/g, '').trim();
    if (sanitized.length === 0) return '';
    return sanitized.split(/\s+/).join(' & ');
  }

  /**
   * Build a SQL fragment for `to_tsvector` across multiple columns.
   * Column names are validated against a strict identifier pattern to prevent injection.
   */
  tsVectorExpression(columns: string[]): string {
    for (const col of columns) {
      if (!VALID_COLUMN_NAME.test(col)) {
        throw new Error(`Invalid column name: ${col}`);
      }
    }
    const coalesced = columns
      .map((col) => `coalesce(${col}, '')`)
      .join(" || ' ' || ");
    return `to_tsvector('english', ${coalesced})`;
  }

  /**
   * Wrap a query with `plainto_tsquery` and a similarity threshold.
   */
  tsQueryExpression(term: string): string {
    const query = this.toTsQuery(term);
    if (query.length === 0) return "plainto_tsquery('english', '')";
    return `plainto_tsquery('english', '${query}')`;
  }

  /**
   * Default field boosting for unified search across entity types.
   * Keys are index document fields mapped during indexing (entityType_fieldName).
   */
  private static readonly ENTITY_BOOST: Record<string, Record<string, number>> =
    {
      profiles: {
        displayName: 3,
        headline: 2,
        about: 1,
        skills: 1,
        location: 0.5,
      },
      companies: { name: 3, industry: 2, description: 1, location: 0.5 },
      jobs: {
        title: 3,
        description: 1,
        skills: 1,
        companyName: 0.5,
        location: 0.5,
      },
      posts: { content: 2, authorName: 1, hashtags: 0.5 },
    };

  /**
   * Build a multi-match query across multiple entity types with per-field boosting.
   *
   * Uses per-index queries via `bool.should` so each index resolves its own
   * field names (e.g. `displayName^3` in the profiles index, `title^3` in jobs).
   */
  buildMultiMatchQuery(
    query: string,
    entityTypes: string[] = ['profiles', 'companies', 'jobs', 'posts'],
    options?: { fuzziness?: string | number; operator?: 'or' | 'and' },
  ): Record<string, unknown> {
    const should: Record<string, unknown>[] = [];

    for (const entityType of entityTypes) {
      const boosts = SearchService.ENTITY_BOOST[entityType];
      if (!boosts) continue;
      const fields = Object.entries(boosts).map(
        ([field, boost]) => `${field}^${boost}`,
      );
      if (fields.length === 0) continue;
      should.push({
        multi_match: {
          query,
          fields,
          type: 'best_fields',
          fuzziness: options?.fuzziness ?? 'AUTO',
          operator: options?.operator ?? 'or',
        },
      });
    }

    if (should.length === 0) {
      return {
        multi_match: {
          query,
          fields: ['_all'],
          type: 'best_fields',
          fuzziness: options?.fuzziness ?? 'AUTO',
          operator: options?.operator ?? 'or',
        },
      };
    }

    return { bool: { should, minimum_should_match: 1 } };
  }

  /**
   * Build a fuzzy query on a single field.
   */
  buildFuzzyQuery(
    field: string,
    value: string,
    options?: { fuzziness?: string | number; prefixLength?: number },
  ): Record<string, unknown> {
    return {
      fuzzy: {
        [field]: {
          value,
          fuzziness: options?.fuzziness ?? 'AUTO',
          prefix_length: options?.prefixLength ?? 2,
        },
      },
    };
  }

  /**
   * Build a boolean query combining must / should / filter / mustNot clauses.
   * Empty clause arrays are omitted from the result.
   */
  buildBoolQuery(clauses: {
    must?: Record<string, unknown>[];
    should?: Record<string, unknown>[];
    filter?: Record<string, unknown>[];
    mustNot?: Record<string, unknown>[];
  }): Record<string, unknown> {
    return {
      bool: Object.fromEntries(
        Object.entries(clauses).filter(([, v]) => v && v.length > 0),
      ),
    };
  }

  /**
   * Build an entity-specific search query with type filter and field boosting.
   */
  buildEntityQuery(
    entityType: string,
    query: string,
    filters?: Record<string, unknown>,
  ): Record<string, unknown> {
    const boosts = SearchService.ENTITY_BOOST[entityType] ?? {};
    const fields = Object.entries(boosts).map(
      ([field, boost]) => `${field}^${boost}`,
    );

    const must: Record<string, unknown>[] = [
      {
        multi_match: {
          query,
          fields: fields.length > 0 ? fields : ['_all'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      },
    ];

    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        must.push({ term: { [field]: value } });
      }
    }

    return {
      query: {
        bool: { must },
      },
    };
  }

  /**
   * Build a full Elasticsearch search body with query, pagination, and sorting.
   */
  buildSearchBody(
    esQuery: Record<string, unknown>,
    options?: {
      from?: number;
      size?: number;
      sort?: Array<Record<string, { order: 'asc' | 'desc' }>>;
      highlight?: Record<string, unknown>;
      _source?: string[];
    },
  ): Record<string, unknown> {
    const body: Record<string, unknown> = { query: esQuery };

    if (options?.from !== undefined) body.from = options.from;
    if (options?.size !== undefined) body.size = options.size;
    if (options?.sort) body.sort = options.sort;
    if (options?.highlight) body.highlight = options.highlight;
    if (options?._source) body._source = options._source;

    return body;
  }
}
