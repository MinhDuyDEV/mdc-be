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
