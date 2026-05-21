import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchIndexService } from './search-index.service';
import { SearchQueryService } from './search-query.service';

describe('SearchController', () => {
  let controller: SearchController;
  let mockSearchQuery: any;
  let mockSearchIndex: any;

  beforeEach(async () => {
    mockSearchQuery = {
      search: jest.fn().mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          hasNextPage: false,
          took: 10,
          engine: 'elasticsearch',
        },
      }),
    };

    mockSearchIndex = {
      reindexEntity: jest.fn().mockResolvedValue('reindex-jobs-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchQueryService, useValue: mockSearchQuery },
        { provide: SearchIndexService, useValue: mockSearchIndex },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should call searchQuery.search for unified search', async () => {
    const query = { q: 'engineer', limit: 20 } as any;
    const req = { user: { id: 'user-1' } };

    await controller.search(query, req);
    expect(mockSearchQuery.search).toHaveBeenCalledWith(query, 'user-1');
  });

  it('should search jobs only', async () => {
    const query = { q: 'engineer', limit: 20 } as any;
    const req = { user: { id: 'user-1' } };

    await controller.searchJobs(query, req);
    expect(mockSearchQuery.search).toHaveBeenCalledWith(
      { ...query, type: ['jobs'] },
      'user-1',
    );
  });

  it('should search users (profiles) only', async () => {
    const query = { q: 'react developer' } as any;
    const req = { user: { id: 'user-1' } };

    await controller.searchUsers(query, req);
    expect(mockSearchQuery.search).toHaveBeenCalledWith(
      { ...query, type: ['profiles'] },
      'user-1',
    );
  });

  it('should search companies only', async () => {
    const query = { q: 'tech startup' } as any;
    const req = { user: { id: 'user-1' } };

    await controller.searchCompanies(query, req);
    expect(mockSearchQuery.search).toHaveBeenCalledWith(
      { ...query, type: ['companies'] },
      'user-1',
    );
  });

  it('should search posts only', async () => {
    const query = { q: 'machine learning' } as any;
    const req = { user: { id: 'user-1' } };

    await controller.searchPosts(query, req);
    expect(mockSearchQuery.search).toHaveBeenCalledWith(
      { ...query, type: ['posts'] },
      'user-1',
    );
  });

  it('should trigger reindex', async () => {
    const req = { user: { id: 'admin-1' } };

    const result = await controller.reindex('jobs', req);
    expect(mockSearchIndex.reindexEntity).toHaveBeenCalledWith(
      'jobs',
      'admin-1',
    );
    expect(result).toEqual({
      message: 'Reindex started for jobs',
      runId: 'reindex-jobs-123',
    });
  });
});
