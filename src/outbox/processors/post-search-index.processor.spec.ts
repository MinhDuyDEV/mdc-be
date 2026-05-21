import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SearchIndexService } from '../../search/search-index.service';
import { PostSearchIndexProcessor } from './post-search-index.processor';

describe('PostSearchIndexProcessor', () => {
  let processor: PostSearchIndexProcessor;
  let mockPrisma: Partial<Record<keyof PrismaService, any>>;
  let mockSearchIndex: Partial<Record<keyof SearchIndexService, any>>;

  const mockPost = {
    id: 'post-1',
    authorId: 'user-1',
    content: 'Hello world',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    reactionCount: 5,
    commentCount: 2,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    author: { id: 'user-1', displayName: 'John Doe' },
    hashtags: [{ hashtag: { name: 'tech' } }],
  };

  beforeEach(() => {
    mockPrisma = {
      post: {
        findUnique: jest.fn().mockResolvedValue(mockPost),
      },
    } as any;

    mockSearchIndex = {
      indexDocument: jest.fn().mockResolvedValue(undefined),
      deleteByQuery: jest.fn().mockResolvedValue(undefined),
    };

    processor = new PostSearchIndexProcessor(
      mockPrisma as unknown as PrismaService,
      mockSearchIndex as unknown as SearchIndexService,
    );
  });

  it('should index post on PostCreated', async () => {
    await processor.processPostCreated({ postId: 'post-1' });
    expect(mockSearchIndex.indexDocument).toHaveBeenCalledWith(
      'posts',
      'post-1',
      expect.objectContaining({
        content: 'Hello world',
        authorName: 'John Doe',
      }),
    );
  });

  it('should index post on PostUpdated', async () => {
    await processor.processPostUpdated({ postId: 'post-1' });
    expect(mockSearchIndex.indexDocument).toHaveBeenCalledWith(
      'posts',
      'post-1',
      expect.objectContaining({ id: 'post-1' }),
    );
  });

  it('should delete from ES on PostDeleted', async () => {
    await processor.processPostDeleted({ postId: 'post-1' });
    expect(mockSearchIndex.deleteByQuery).toHaveBeenCalledWith('posts', {
      term: { id: 'post-1' },
    });
  });

  it('should skip when post not found', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce(null);
    await processor.processPostCreated({ postId: 'nonexistent' });
    expect(mockSearchIndex.indexDocument).not.toHaveBeenCalled();
  });

  it('should remove soft-deleted post from ES', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      ...mockPost,
      deletedAt: new Date(),
    });
    await processor.processPostCreated({ postId: 'post-1' });
    expect(mockSearchIndex.deleteByQuery).toHaveBeenCalledWith('posts', {
      term: { id: 'post-1' },
    });
  });
});
