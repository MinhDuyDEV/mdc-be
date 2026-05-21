import type { PinoLogger } from 'nestjs-pino';
import { SearchService } from './search.service';
import { SearchIndexService } from './search-index.service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    service = new SearchService();
  });

  describe('toTsQuery', () => {
    it('converts plain text to tsquery format', () => {
      expect(service.toTsQuery('senior engineer')).toBe('senior & engineer');
    });

    it('sanitizes special characters', () => {
      expect(service.toTsQuery("hello'; DROP TABLE")).toBe(
        'hello & DROP & TABLE',
      );
    });

    it('returns empty string for empty input', () => {
      expect(service.toTsQuery('')).toBe('');
    });

    it('handles whitespace-only input', () => {
      expect(service.toTsQuery('   ')).toBe('');
    });
  });

  describe('tsVectorExpression', () => {
    it('builds tsvector expression from columns', () => {
      const expr = service.tsVectorExpression(['title', 'description']);
      expect(expr).toBe(
        "to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))",
      );
    });

    it('handles single column', () => {
      const expr = service.tsVectorExpression(['name']);
      expect(expr).toBe("to_tsvector('english', coalesce(name, ''))");
    });
  });

  describe('tsQueryExpression', () => {
    it('wraps term in plainto_tsquery', () => {
      expect(service.tsQueryExpression('react developer')).toBe(
        "plainto_tsquery('english', 'react & developer')",
      );
    });

    it('returns empty query for empty term', () => {
      expect(service.tsQueryExpression('')).toBe(
        "plainto_tsquery('english', '')",
      );
    });
  });

  describe('buildMultiMatchQuery', () => {
    it('returns correct field boosting for valid entity types', () => {
      const result = service.buildMultiMatchQuery('senior engineer', [
        'profiles',
        'companies',
      ]);
      const { multi_match: mm } = result as {
        multi_match: { fields: string[] };
      };
      expect(mm.fields).toContain('profiles_displayName^3');
      expect(mm.fields).toContain('companies_name^3');
      expect(mm.fields).toContain('profiles_about^1');
      expect(mm.fields).not.toContain('jobs_title^3');
    });

    it('falls back to _all for unknown entity types', () => {
      const result = service.buildMultiMatchQuery('test', ['unknown']);
      const { multi_match: mm } = result as {
        multi_match: { fields: string[] };
      };
      expect(mm.fields).toEqual(['_all']);
    });

    it('accepts custom fuzziness and operator', () => {
      const result = service.buildMultiMatchQuery('test', [], {
        fuzziness: 1,
        operator: 'and',
      });
      const { multi_match: mm } = result as {
        multi_match: { fuzziness: number; operator: string };
      };
      expect(mm.fuzziness).toBe(1);
      expect(mm.operator).toBe('and');
    });
  });

  describe('buildFuzzyQuery', () => {
    it('builds fuzzy query with default options', () => {
      const result = service.buildFuzzyQuery('title', 'developer');
      const { fuzzy } = result as {
        fuzzy: Record<
          string,
          { value: string; fuzziness: string; prefix_length: number }
        >;
      };
      expect(fuzzy.title.value).toBe('developer');
      expect(fuzzy.title.fuzziness).toBe('AUTO');
      expect(fuzzy.title.prefix_length).toBe(2);
    });

    it('accepts custom fuzziness and prefix length', () => {
      const result = service.buildFuzzyQuery('name', 'john', {
        fuzziness: '2',
        prefixLength: 3,
      });
      const { fuzzy } = result as {
        fuzzy: Record<string, { fuzziness: string; prefix_length: number }>;
      };
      expect(fuzzy.name.fuzziness).toBe('2');
      expect(fuzzy.name.prefix_length).toBe(3);
    });
  });

  describe('buildBoolQuery', () => {
    it('builds bool query with must and filter clauses', () => {
      const result = service.buildBoolQuery({
        must: [{ match: { title: 'test' } }],
        filter: [{ term: { status: 'active' } }],
      });
      const { bool } = result as {
        bool: { must: unknown[]; filter: unknown[] };
      };
      expect(bool.must).toEqual([{ match: { title: 'test' } }]);
      expect(bool.filter).toEqual([{ term: { status: 'active' } }]);
    });

    it('omits empty clause arrays', () => {
      const result = service.buildBoolQuery({
        must: [{ match: { title: 'test' } }],
        should: [],
        filter: [{ term: { status: 'active' } }],
      });
      const { bool } = result as {
        bool: { must: unknown[]; should?: unknown[]; filter: unknown[] };
      };
      expect(bool.must).toBeDefined();
      expect(bool.should).toBeUndefined();
      expect(bool.filter).toBeDefined();
    });

    it('returns empty bool when all clauses empty', () => {
      const result = service.buildBoolQuery({ must: [], should: [] });
      const { bool } = result as {
        bool: Record<string, unknown>;
      };
      expect(bool).toEqual({});
    });
  });

  describe('buildEntityQuery', () => {
    it('includes entity-specific boosted fields', () => {
      const result = service.buildEntityQuery('profiles', 'senior engineer');
      const { query } = result as {
        query: { bool: { must: Array<Record<string, unknown>> } };
      };
      const mm = query.bool.must[0] as {
        multi_match: { fields: string[] };
      };
      expect(mm.multi_match.fields).toContain('displayName^3');
      expect(mm.multi_match.fields).toContain('headline^2');
      expect(mm.multi_match.fields).toContain('location^0.5');
    });

    it('applies term filters', () => {
      const result = service.buildEntityQuery('jobs', 'developer', {
        status: 'active',
      });
      const { query } = result as {
        query: { bool: { must: unknown[] } };
      };
      const must = query.bool.must;
      expect(must).toHaveLength(2);
      expect(must).toContainEqual({ term: { status: 'active' } });
    });

    it('falls back to _all for unknown entity type', () => {
      const result = service.buildEntityQuery('unknown', 'test');
      const { query } = result as {
        query: { bool: { must: Array<Record<string, unknown>> } };
      };
      const mm = query.bool.must[0] as {
        multi_match: { fields: string[] };
      };
      expect(mm.multi_match.fields).toEqual(['_all']);
    });
  });

  describe('buildSearchBody', () => {
    it('wraps query with from/size/sort options', () => {
      const esQuery = { match_all: {} };
      const result = service.buildSearchBody(esQuery, {
        from: 10,
        size: 20,
        sort: [{ createdAt: { order: 'desc' as const } }],
      });
      expect(result).toEqual({
        query: { match_all: {} },
        from: 10,
        size: 20,
        sort: [{ createdAt: { order: 'desc' } }],
      });
    });

    it('includes highlight and _source when provided', () => {
      const result = service.buildSearchBody(
        { match: { title: 'test' } },
        {
          highlight: { fields: { title: {} } },
          _source: ['id', 'title'],
        },
      );
      expect(result).toHaveProperty('highlight');
      expect(result).toHaveProperty('_source', ['id', 'title']);
    });

    it('returns only query when no options provided', () => {
      const result = service.buildSearchBody({ match_all: {} });
      expect(result).toEqual({ query: { match_all: {} } });
    });
  });
});

describe('SearchIndexService', () => {
  let service: SearchIndexService;
  let mockSearchEngine: {
    index: jest.Mock;
    search: jest.Mock;
    deleteByQuery: jest.Mock;
    checkClusterHealth: jest.Mock;
  };
  let mockLogger: { warn: jest.Mock; setContext: jest.Mock };

  beforeEach(() => {
    mockSearchEngine = {
      index: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ hits: [] }),
      deleteByQuery: jest.fn().mockResolvedValue(undefined),
      checkClusterHealth: jest.fn(),
    };
    mockLogger = {
      warn: jest.fn(),
      setContext: jest.fn(),
    };
    service = new SearchIndexService(
      mockSearchEngine as never,
      mockLogger as unknown as PinoLogger,
    );
  });

  describe('indexDocument', () => {
    it('indexes document via SearchEngineService', async () => {
      await service.indexDocument('posts', '1', { title: 'Hello' });
      expect(mockSearchEngine.index).toHaveBeenCalledWith('posts', '1', {
        title: 'Hello',
      });
    });

    it('logs warning and does not throw when ES fails', async () => {
      mockSearchEngine.index.mockRejectedValue(
        new Error('ES connection refused'),
      );
      await expect(
        service.indexDocument('posts', '1', { title: 'Hello' }),
      ).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SearchIndexService'),
      );
    });
  });

  describe('deleteByQuery', () => {
    it('deletes documents via SearchEngineService', async () => {
      await service.deleteByQuery('posts', {
        query: { match: { title: 'Hello' } },
      });
      expect(mockSearchEngine.deleteByQuery).toHaveBeenCalledWith('posts', {
        query: { match: { title: 'Hello' } },
      });
    });

    it('logs warning when delete fails', async () => {
      mockSearchEngine.deleteByQuery.mockRejectedValue(new Error('ES error'));
      await expect(
        service.deleteByQuery('posts', { query: {} }),
      ).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('returns search results', async () => {
      const hits = { hits: [{ _id: '1', _source: { title: 'Hello' } }] };
      mockSearchEngine.search.mockResolvedValue(hits);
      const result = await service.search('posts', {
        query: { match_all: {} },
      });
      expect(result).toBe(hits);
      expect(mockSearchEngine.search).toHaveBeenCalledWith('posts', {
        query: { match_all: {} },
      });
    });
  });
});
