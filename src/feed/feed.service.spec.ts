import { PostVisibility } from '@prisma/client';
import { FeedService } from './feed.service';
import { FeedSortOrder } from './dto/feed-query.dto';

describe('FeedService', () => {
  let service: FeedService;
  let prisma: any;
  let connectionsPolicy: any;
  let configService: any;

  beforeEach(() => {
    prisma = {
      post: { findMany: jest.fn() },
      connection: { findMany: jest.fn() },
      follow: { findMany: jest.fn() },
      block: { findMany: jest.fn() },
      companyMember: { findMany: jest.fn() },
      hashtag: { findUnique: jest.fn() },
      hiddenPost: { findMany: jest.fn() },
    };
    connectionsPolicy = {
      areConnected: jest.fn().mockResolvedValue(false),
      isBlocked: jest.fn().mockResolvedValue(false),
    };
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    prisma.hiddenPost = { findMany: jest.fn().mockResolvedValue([]) };
    service = new FeedService(prisma, connectionsPolicy, configService);
  });

  // ---------------------------------------------------------------------------
  // getHomeFeed
  // ---------------------------------------------------------------------------
  describe('getHomeFeed', () => {
    it('returns public posts for unauthenticated user without querying social graph', async () => {
      prisma.post.findMany.mockResolvedValue([
        { id: 'post1', createdAt: new Date() },
      ]);

      const result = await service.getHomeFeed(undefined, { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(prisma.connection.findMany).not.toHaveBeenCalled();
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ visibility: PostVisibility.PUBLIC }),
            ]),
          }),
        }),
      );
    });

    it('queries social graph and filters by authorId for authenticated user', async () => {
      prisma.connection.findMany.mockResolvedValue([
        { requesterId: 'user1', addresseeId: 'user2' },
      ]);
      prisma.follow.findMany.mockResolvedValue([]);
      prisma.block.findMany.mockResolvedValue([]);
      prisma.post.findMany.mockResolvedValue([]);

      await service.getHomeFeed('user1', { limit: 20 });

      expect(prisma.connection.findMany).toHaveBeenCalled();
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ authorId: 'user1' }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('excludes blocked users from visible author set', async () => {
      prisma.connection.findMany.mockResolvedValue([
        { requesterId: 'user1', addresseeId: 'user2' },
      ]);
      prisma.follow.findMany.mockResolvedValue([]);
      prisma.block.findMany.mockResolvedValue([
        { blockerId: 'user1', blockedId: 'user2' },
      ]);
      prisma.post.findMany.mockResolvedValue([]);

      await service.getHomeFeed('user1', { limit: 20 });

      const call = prisma.post.findMany.mock.calls[0][0];
      const orArray: Array<{ authorId?: string | { in?: string[] } }> =
        call.where.AND[0].OR;
      // Should have only self in OR (user2 blocked, no follows)
      expect(orArray).toHaveLength(1);
      expect(orArray[0].authorId).toBe('user1');
    });

    it('returns hasNextPage=true and nextCursor when more rows exist', async () => {
      const rows = Array.from({ length: 21 }, (_, i) => ({
        id: `post${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      }));
      prisma.post.findMany.mockResolvedValue(rows);

      const result = await service.getHomeFeed(undefined, { limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getProfileFeed
  // ---------------------------------------------------------------------------
  describe('getProfileFeed', () => {
    it('returns only PUBLIC posts for anonymous viewer', async () => {
      prisma.post.findMany.mockResolvedValue([]);

      await service.getProfileFeed(undefined, 'user1', { limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ visibility: PostVisibility.PUBLIC }),
            ]),
          }),
        }),
      );
    });

    it('returns PUBLIC + CONNECTIONS posts when viewer is connected', async () => {
      connectionsPolicy.areConnected.mockResolvedValue(true);
      prisma.post.findMany.mockResolvedValue([]);

      await service.getProfileFeed('viewer1', 'user1', { limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                visibility: {
                  in: [PostVisibility.PUBLIC, PostVisibility.CONNECTIONS],
                },
              }),
            ]),
          }),
        }),
      );
    });

    it('applies no visibility filter when viewer is the profile owner', async () => {
      prisma.post.findMany.mockResolvedValue([]);

      await service.getProfileFeed('user1', 'user1', { limit: 20 });

      expect(connectionsPolicy.areConnected).not.toHaveBeenCalled();
      const call = prisma.post.findMany.mock.calls[0][0];
      expect(call.where.AND[0].visibility).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getCompanyFeed
  // ---------------------------------------------------------------------------
  describe('getCompanyFeed', () => {
    it('returns PUBLIC posts from active company members', async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ userId: 'member1' }]);
      prisma.post.findMany.mockResolvedValue([]);

      await service.getCompanyFeed('company1', { limit: 20 });

      expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company1', status: 'active' },
        }),
      );
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                authorId: { in: ['member1'] },
                visibility: PostVisibility.PUBLIC,
              }),
            ]),
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getHashtagFeed
  // ---------------------------------------------------------------------------
  describe('getHashtagFeed', () => {
    it('returns empty result when hashtag does not exist', async () => {
      prisma.hashtag.findUnique.mockResolvedValue(null);

      const result = await service.getHashtagFeed('unknown', { limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.hasNextPage).toBe(false);
      expect(prisma.post.findMany).not.toHaveBeenCalled();
    });

    it('lowercases the tag before lookup', async () => {
      prisma.hashtag.findUnique.mockResolvedValue(null);

      await service.getHashtagFeed('NestJS', { limit: 20 });

      expect(prisma.hashtag.findUnique).toHaveBeenCalledWith({
        where: { name: 'nestjs' },
      });
    });

    it('returns PUBLIC posts for existing hashtag', async () => {
      prisma.hashtag.findUnique.mockResolvedValue({
        id: 'ht1',
        name: 'nestjs',
      });
      prisma.post.findMany.mockResolvedValue([
        { id: 'post1', createdAt: new Date() },
      ]);

      const result = await service.getHashtagFeed('nestjs', { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                hashtags: { some: { hashtagId: 'ht1' } },
                visibility: PostVisibility.PUBLIC,
              }),
            ]),
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Ranking (sort=ranked)
  // ---------------------------------------------------------------------------
  describe('getHomeFeed with ranked sort', () => {
    beforeEach(() => {
      prisma.connection.findMany.mockResolvedValue([
        { requesterId: 'user1', addresseeId: 'user2' },
      ]);
      prisma.follow.findMany.mockResolvedValue([]);
      prisma.block.findMany.mockResolvedValue([]);
    });

    it('returns posts sorted by score (engagement-weighted) when sort=ranked, overriding chronological order', async () => {
      const now = Date.now();
      const posts = [
        {
          id: 'recent-low-eng',
          createdAt: new Date(now - 1000),
          authorId: 'user1',
          reactionCount: 0,
          commentCount: 0,
          author: { id: 'user1', email: 'a@b.com', profile: null },
          hashtags: [],
          _count: { reactions: 0, comments: 0 },
        },
        {
          id: 'older-high-eng',
          createdAt: new Date(now - 3_600_000 * 2), // 2 hours old
          authorId: 'user1',
          reactionCount: 20,
          commentCount: 10,
          author: { id: 'user1', email: 'a@b.com', profile: null },
          hashtags: [],
          _count: { reactions: 20, comments: 10 },
        },
      ];
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await service.getHomeFeed('user1', {
        limit: 5,
        sort: FeedSortOrder.RANKED,
      });

      expect(result.data).toHaveLength(2);
      // older-high-eng has much higher engagement → higher score despite being older
      expect(result.data[0].id).toBe('older-high-eng');
      expect(result.data[1].id).toBe('recent-low-eng');
    });

    it('gives higher scores to own posts vs connections vs followed vs strangers', async () => {
      const baseTime = new Date(Date.now() - 60_000); // 1 minute old

      prisma.follow.findMany.mockResolvedValue([{ followeeId: 'user3' }]);

      const posts = [
        {
          id: 'stranger',
          createdAt: baseTime,
          authorId: 'user4',
          reactionCount: 0,
          commentCount: 0,
          author: { id: 'user4', email: 'd@e.com', profile: null },
          hashtags: [],
          _count: { reactions: 0, comments: 0 },
        },
        {
          id: 'followed',
          createdAt: baseTime,
          authorId: 'user3',
          reactionCount: 0,
          commentCount: 0,
          author: { id: 'user3', email: 'c@d.com', profile: null },
          hashtags: [],
          _count: { reactions: 0, comments: 0 },
        },
        {
          id: 'connection',
          createdAt: baseTime,
          authorId: 'user2',
          reactionCount: 0,
          commentCount: 0,
          author: { id: 'user2', email: 'b@c.com', profile: null },
          hashtags: [],
          _count: { reactions: 0, comments: 0 },
        },
        {
          id: 'own',
          createdAt: baseTime,
          authorId: 'user1',
          reactionCount: 0,
          commentCount: 0,
          author: { id: 'user1', email: 'a@b.com', profile: null },
          hashtags: [],
          _count: { reactions: 0, comments: 0 },
        },
      ];
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await service.getHomeFeed('user1', {
        limit: 5,
        sort: FeedSortOrder.RANKED,
      });

      const ids = result.data.map((p: any) => p.id);
      // recency+engagement identical → differentiated only by relationship weight
      // expected order: own (1.0) > connection (0.7) > followed (0.4) > stranger (0.2)
      expect(ids).toEqual(['own', 'connection', 'followed', 'stranger']);
    });

    it('applies recency decay so older posts get lower scores', async () => {
      const posts = [
        {
          id: 'old-post',
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours old
          authorId: 'user1',
          reactionCount: 10,
          commentCount: 5,
          author: { id: 'user1', email: 'a@b.com', profile: null },
          hashtags: [],
          _count: { reactions: 10, comments: 5 },
        },
        {
          id: 'recent-post',
          createdAt: new Date(Date.now() - 60_000), // 1 minute old
          authorId: 'user1',
          reactionCount: 10,
          commentCount: 5,
          author: { id: 'user1', email: 'a@b.com', profile: null },
          hashtags: [],
          _count: { reactions: 10, comments: 5 },
        },
      ];
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await service.getHomeFeed('user1', {
        limit: 5,
        sort: FeedSortOrder.RANKED,
      });

      // Same engagement and author → only recency differentiates
      expect(result.data[0].id).toBe('recent-post');
      expect(result.data[1].id).toBe('old-post');
    });
  });

  // ---------------------------------------------------------------------------
  // Trending hashtags
  // ---------------------------------------------------------------------------
  describe('getTrendingHashtags', () => {
    beforeEach(() => {
      prisma.trendingHashtag = {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      };
    });

    it('returns hashtags ordered by score descending', async () => {
      const mockTrending = [
        {
          id: 't1',
          hashtagId: 'h1',
          score: 100,
          windowStart: new Date(),
          windowEnd: new Date(),
          createdAt: new Date(),
          hashtag: { id: 'h1', name: 'typescript', postCount: 50 },
        },
        {
          id: 't2',
          hashtagId: 'h2',
          score: 50,
          windowStart: new Date(),
          windowEnd: new Date(),
          createdAt: new Date(),
          hashtag: { id: 'h2', name: 'nestjs', postCount: 25 },
        },
      ];
      prisma.trendingHashtag.findMany.mockResolvedValue(mockTrending);

      const result = await service.getTrendingHashtags(5);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('t1');
      expect(result[0].hashtag.name).toBe('typescript');
      expect(result[1].id).toBe('t2');
      expect(result[1].hashtag.name).toBe('nestjs');
      expect(prisma.trendingHashtag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { score: 'desc' },
          take: 5,
        }),
      );
    });

    it('returns empty array when no trending hashtags exist', async () => {
      prisma.trendingHashtag.findMany.mockResolvedValue([]);

      const result = await service.getTrendingHashtags(10);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Feed enrichment — author profile data
  // ---------------------------------------------------------------------------
  describe('feed enrichment', () => {
    it('includes author profile (firstName, lastName, headline) in getHomeFeed response', async () => {
      prisma.post.findMany.mockResolvedValue([
        {
          id: 'post1',
          createdAt: new Date(),
          authorId: 'u1',
          reactionCount: 0,
          commentCount: 0,
          author: {
            id: 'u1',
            email: 'john@test.com',
            profile: {
              firstName: 'John',
              lastName: 'Doe',
              headline: 'Software Developer',
            },
          },
          hashtags: [],
          _count: { reactions: 0, comments: 0 },
        },
      ]);

      const result = await service.getHomeFeed(undefined, { limit: 10 });

      expect(result.data[0].author).toBeDefined();
      expect(result.data[0].author.id).toBe('u1');
      expect(result.data[0].author.email).toBe('john@test.com');
      expect(result.data[0].author.profile).toBeDefined();
      expect(result.data[0].author.profile!.firstName).toBe('John');
      expect(result.data[0].author.profile!.lastName).toBe('Doe');
      expect(result.data[0].author.profile!.headline).toBe(
        'Software Developer',
      );
    });
  });
});
