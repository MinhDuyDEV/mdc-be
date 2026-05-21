import { SearchEngineService } from './search-engine.service';

interface MockClient {
  cluster: { health: jest.Mock };
  indices: {
    create: jest.Mock;
    putMapping: jest.Mock;
    delete: jest.Mock;
    updateAliases: jest.Mock;
  };
  helpers: {
    bulk: jest.Mock;
  };
  count: jest.Mock;
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
      indices: {
        create: jest.fn().mockResolvedValue({}),
        putMapping: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        updateAliases: jest.fn().mockResolvedValue({}),
      },
      helpers: {
        bulk: jest.fn().mockResolvedValue({ total: 42 }),
      },
      count: jest.fn().mockResolvedValue({ count: 42 }),
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

  describe('createIndex', () => {
    it('creates index with mappings and settings', async () => {
      await service.createIndex(
        'test-index',
        { properties: { title: { type: 'text' } } },
        { number_of_shards: 1 },
      );
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: 'test-index',
        mappings: { properties: { title: { type: 'text' } } },
        settings: { number_of_shards: 1 },
      });
    });

    it('creates index without mappings or settings when omitted', async () => {
      await service.createIndex('test-index');
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });
  });

  describe('putMapping', () => {
    it('updates index mappings', async () => {
      await service.putMapping('test-index', {
        properties: { title: { type: 'text' } },
      });
      expect(mockClient.indices.putMapping).toHaveBeenCalledWith({
        index: 'test-index',
        properties: { title: { type: 'text' } },
      });
    });
  });

  describe('deleteIndex', () => {
    it('deletes an index', async () => {
      await service.deleteIndex('test-index');
      expect(mockClient.indices.delete).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });
  });

  describe('updateAliases', () => {
    it('updates aliases atomically', async () => {
      const actions = [
        { add: { index: 'posts-v2', alias: 'posts' } },
        { remove: { index: 'posts-v1', alias: 'posts' } },
      ];
      await service.updateAliases(actions);
      expect(mockClient.indices.updateAliases).toHaveBeenCalledWith({
        body: { actions },
      });
    });
  });

  describe('bulkIndex', () => {
    it('bulk indexes documents and returns total count', async () => {
      const datasource = [
        { id: '1', body: { title: 'Doc 1' } },
        { id: '2', body: { title: 'Doc 2' } },
      ];
      const total = await service.bulkIndex(datasource, {
        index: 'test-index',
      });
      expect(total).toBe(42);
      expect(mockClient.helpers.bulk).toHaveBeenCalledWith({
        datasource,
        onDocument: expect.any(Function),
        retries: 3,
      });
    });
  });

  describe('getCount', () => {
    it('returns document count without query', async () => {
      const count = await service.getCount('test-index');
      expect(count).toBe(42);
      expect(mockClient.count).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });

    it('returns document count with query', async () => {
      const count = await service.getCount('test-index', {
        match: { status: 'active' },
      });
      expect(count).toBe(42);
      expect(mockClient.count).toHaveBeenCalledWith({
        index: 'test-index',
        body: { query: { match: { status: 'active' } } },
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
