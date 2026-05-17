import { SearchEngineService } from './search-engine.service';

interface MockClient {
  cluster: { health: jest.Mock };
  index: jest.Mock;
  search: jest.Mock;
  deleteByQuery: jest.Mock;
  close: jest.Mock;
}

describe('SearchEngineService', () => {
  let service: SearchEngineService;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = {
      cluster: { health: jest.fn() },
      index: jest.fn(),
      search: jest.fn(),
      deleteByQuery: jest.fn(),
      close: jest.fn(),
    };
    service = new SearchEngineService(mockClient as never);
  });

  describe('checkClusterHealth', () => {
    it('returns up when cluster is healthy (green)', async () => {
      mockClient.cluster.health.mockResolvedValue({ status: 'green' });
      const result = await service.checkClusterHealth();
      expect(result.status).toBe('up');
      expect(result.message).toContain('green');
    });

    it('returns up when cluster status is yellow', async () => {
      mockClient.cluster.health.mockResolvedValue({ status: 'yellow' });
      const result = await service.checkClusterHealth();
      expect(result.status).toBe('up');
      expect(result.message).toContain('yellow');
    });

    it('returns down when cluster status is red', async () => {
      mockClient.cluster.health.mockResolvedValue({ status: 'red' });
      const result = await service.checkClusterHealth();
      expect(result.status).toBe('down');
      expect(result.message).toContain('red');
    });

    it('returns down when cluster.health throws', async () => {
      mockClient.cluster.health.mockRejectedValue(
        new Error('Connection refused'),
      );
      const result = await service.checkClusterHealth();
      expect(result.status).toBe('down');
      expect(result.message).toBe('Connection refused');
    });
  });

  describe('index', () => {
    it('resolves', async () => {
      mockClient.index.mockResolvedValue({ result: 'created' });
      await expect(
        service.index('posts', '1', { title: 'Hello' }),
      ).resolves.toBeUndefined();
      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'posts',
        id: '1',
        body: { title: 'Hello' },
      });
    });
  });

  describe('search', () => {
    it('returns results', async () => {
      const hits = { hits: [{ _id: '1', _source: { title: 'Hello' } }] };
      mockClient.search.mockResolvedValue(hits);
      const result = await service.search('posts', {
        query: { match_all: {} },
      });
      expect(result).toBe(hits);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'posts',
        body: { query: { match_all: {} } },
      });
    });
  });

  describe('deleteByQuery', () => {
    it('resolves', async () => {
      mockClient.deleteByQuery.mockResolvedValue({ deleted: 1 });
      await expect(
        service.deleteByQuery('posts', {
          query: { match: { title: 'Hello' } },
        }),
      ).resolves.toBeUndefined();
      expect(mockClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'posts',
        body: { query: { match: { title: 'Hello' } } },
      });
    });
  });

  describe('onApplicationShutdown', () => {
    it('calls client.close', async () => {
      mockClient.close.mockResolvedValue(undefined);
      await service.onApplicationShutdown();
      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });
  });
});
