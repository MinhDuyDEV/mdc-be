import { PinoLogger } from 'nestjs-pino';
import { SearchEngineService } from '../infra/search-engine/search-engine.service';
import { SearchSuggestService } from './search-suggest.service';
import { SearchService } from './search.service';

function createMockLogger(): jest.Mocked<PinoLogger> {
  const logger = {
    setContext: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  } as any;
  return logger;
}

function createMockSearchEngine(): jest.Mocked<SearchEngineService> {
  return {
    search: jest.fn(),
    index: jest.fn(),
    deleteByQuery: jest.fn(),
    createIndex: jest.fn(),
    putMapping: jest.fn(),
    deleteIndex: jest.fn(),
    updateAliases: jest.fn(),
    bulkIndex: jest.fn(),
    getCount: jest.fn(),
    listIndices: jest.fn(),
    checkClusterHealth: jest.fn(),
    onApplicationShutdown: jest.fn(),
  } as any;
}

describe('SearchSuggestService', () => {
  let service: SearchSuggestService;
  let mockSearchEngine: jest.Mocked<SearchEngineService>;
  let mockSearchService: SearchService;

  beforeEach(() => {
    mockSearchEngine = createMockSearchEngine();
    mockSearchService = new SearchService();
    service = new SearchSuggestService(
      mockSearchEngine,
      mockSearchService,
      createMockLogger(),
    );
  });

  describe('suggest', () => {
    it('returns normalized hits when ES responds', async () => {
      mockSearchEngine.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _id: 'profile-1',
              _index: 'profiles-v1',
              _score: 2.5,
              _source: { displayName: 'Senior Engineer' },
            },
          ],
        },
      });

      const result = await service.suggest('sen');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'profile-1',
        type: 'profile',
        text: 'Senior Engineer',
        score: 2.5,
      });
      expect(result.meta.took).toBeGreaterThanOrEqual(0);
    });

    it('returns empty data when ES throws', async () => {
      mockSearchEngine.search.mockRejectedValue(new Error('ES unavailable'));

      const result = await service.suggest('test');

      expect(result.data).toEqual([]);
      expect(result.meta.took).toBeGreaterThanOrEqual(0);
    });

    it('passes size to ES via buildSearchBody and returns the response', async () => {
      const hits = Array.from({ length: 5 }, (_, i) => ({
        _id: `hit-${i}`,
        _index: 'profiles-v1',
        _score: 1.0,
        _source: { displayName: `Name ${i}` },
      }));
      mockSearchEngine.search.mockResolvedValue({ hits: { hits } });

      await service.suggest('na', undefined, 5);

      // The service forwards the limit to ES via the request body and
      // trusts ES to honor `size`. The response is returned as-is.
      expect(mockSearchEngine.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ size: 5 }),
      );
    });

    it('returns the full ES response when ES returns more than the requested size (defensive — should never happen in prod)', async () => {
      const hits = Array.from({ length: 15 }, (_, i) => ({
        _id: `hit-${i}`,
        _index: 'profiles-v1',
        _score: 1.0,
        _source: { displayName: `Name ${i}` },
      }));
      mockSearchEngine.search.mockResolvedValue({ hits: { hits } });

      const result = await service.suggest('na', undefined, 5);

      // ES is trusted to honor `size: 5`; if it returns more, the
      // service does not silently truncate. Callers that need a hard
      // cap should slice the response themselves.
      expect(result.data).toHaveLength(15);
    });

    it('resolves entity type from index name', async () => {
      mockSearchEngine.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _id: 'job-1',
              _index: 'jobs-v2',
              _score: 1.0,
              _source: { title: 'Engineer' },
            },
            {
              _id: 'com-1',
              _index: 'companies-v1',
              _score: 0.8,
              _source: { name: 'Acme' },
            },
            {
              _id: 'post-1',
              _index: 'posts-v3',
              _score: 0.5,
              _source: { authorName: 'Jane' },
            },
          ],
        },
      });

      const result = await service.suggest('eng');

      expect(result.data).toHaveLength(3);
      expect(result.data[0].type).toBe('job');
      expect(result.data[1].type).toBe('company');
      expect(result.data[2].type).toBe('post');
    });

    it('resolves display text from appropriate _source fields', async () => {
      mockSearchEngine.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _id: 'j1',
              _index: 'jobs-v1',
              _score: 1.0,
              _source: { title: 'Backend Dev', companyName: 'Tech Co' },
            },
          ],
        },
      });

      const result = await service.suggest('back');

      expect(result.data[0].text).toBe('Backend Dev');
    });

    it('handles empty ES response gracefully', async () => {
      mockSearchEngine.search.mockResolvedValue({ hits: { hits: [] } });

      const result = await service.suggest('zzz');

      expect(result.data).toEqual([]);
    });
  });
});
