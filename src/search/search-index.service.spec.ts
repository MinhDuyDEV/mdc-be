import { SearchIndexService } from './search-index.service';

describe('SearchIndexService', () => {
  let service: SearchIndexService;
  let mockSearchEngine: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockSearchEngine = {
      index: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({}),
      deleteByQuery: jest.fn().mockResolvedValue(undefined),
      createIndex: jest.fn().mockResolvedValue(undefined),
      updateAliases: jest.fn().mockResolvedValue(undefined),
      deleteIndex: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      searchReindexRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    service = new SearchIndexService(mockSearchEngine, mockPrisma, {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any);
  });

  describe('createSearchIndex', () => {
    it('should create index with mappings and aliases', async () => {
      await service.createSearchIndex('jobs', 1);

      expect(mockSearchEngine.createIndex).toHaveBeenCalledWith(
        'jobs-v1',
        expect.objectContaining({
          properties: expect.any(Object),
        }),
        expect.objectContaining({ number_of_shards: 1 }),
      );
      expect(mockSearchEngine.updateAliases).toHaveBeenCalledWith([
        {
          add: {
            index: 'jobs-v1',
            alias: 'jobs-write',
            is_write_index: true,
          },
        },
        { add: { index: 'jobs-v1', alias: 'jobs' } },
      ]);
    });
  });

  describe('reindexEntity', () => {
    it('should create reindex run and swap aliases', async () => {
      const runId = await service.reindexEntity('jobs', 'admin-1');

      expect(runId).toContain('reindex-jobs-');
      expect(mockPrisma.searchReindexRun.create).toHaveBeenCalled();
      expect(mockSearchEngine.createIndex).toHaveBeenCalled();
      expect(mockSearchEngine.updateAliases).toHaveBeenCalled();
      expect(mockPrisma.searchReindexRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: runId },
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('should record failure on error', async () => {
      mockSearchEngine.createIndex.mockRejectedValue(new Error('ES down'));

      await expect(service.reindexEntity('jobs', 'admin-1')).rejects.toThrow(
        'ES down',
      );
      expect(mockPrisma.searchReindexRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });
  });
});
