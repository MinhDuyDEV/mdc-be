import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostStatus, PostVisibility } from '@prisma/client';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: any;
  let outbox: any;
  let idempotency: any;
  let postsPolicy: any;

  beforeEach(() => {
    prisma = {
      post: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      comment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      reaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      hashtag: { upsert: jest.fn(), update: jest.fn() },
      postHashtag: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      postMedia: { createMany: jest.fn() },
      mention: { create: jest.fn(), deleteMany: jest.fn() },
      user: { findUnique: jest.fn(), findFirst: jest.fn() },
      savedPost: { upsert: jest.fn(), updateMany: jest.fn() },
      hiddenPost: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    outbox = { emit: jest.fn() };
    idempotency = { claim: jest.fn() };
    postsPolicy = { canViewPost: jest.fn().mockResolvedValue(true) };

    service = new PostsService(prisma, outbox, idempotency, postsPolicy);
  });

  describe('createPost', () => {
    it('should create post with hashtags and emit PostCreated event', async () => {
      const dto = {
        content: '@alice Hello #world',
        visibility: PostVisibility.PUBLIC,
      };

      prisma.post.create.mockResolvedValue({
        id: 'post1',
        authorId: 'user1',
        content: dto.content,
        visibility: dto.visibility,
        status: PostStatus.PUBLISHED,
      });

      prisma.hashtag.upsert.mockResolvedValue({
        id: 'hashtag1',
        name: 'world',
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'user2' });

      await service.createPost('user1', dto);

      expect(prisma.post.create).toHaveBeenCalled();
      expect(prisma.hashtag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'world' } }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'PostCreated' }),
      );
    });

    it('should emit MentionCreated event for each resolved mention', async () => {
      const dto = { content: 'Hey @alice', visibility: PostVisibility.PUBLIC };

      prisma.post.create.mockResolvedValue({
        id: 'post2',
        authorId: 'user1',
        content: dto.content,
        visibility: dto.visibility,
        status: PostStatus.PUBLISHED,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'alice-id' });

      await service.createPost('user1', dto);

      expect(prisma.mention.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mentionedUserId: 'alice-id' }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'MentionCreated' }),
      );
    });
  });

  describe('getPost', () => {
    it('should return post when viewer can see it', async () => {
      postsPolicy.canViewPost.mockResolvedValue(true);
      prisma.post.findUnique.mockResolvedValue({
        id: 'post1',
        authorId: 'user1',
        deletedAt: null,
      });

      const result = await service.getPost('viewer1', 'post1');
      expect(result).toBeDefined();
      expect(result.id).toBe('post1');
    });

    it('should throw NotFoundException when viewer cannot see post', async () => {
      postsPolicy.canViewPost.mockResolvedValue(false);

      await expect(service.getPost('viewer1', 'post1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for soft-deleted post', async () => {
      postsPolicy.canViewPost.mockResolvedValue(true);
      prisma.post.findUnique.mockResolvedValue({
        id: 'post1',
        deletedAt: new Date(),
      });

      await expect(service.getPost('viewer1', 'post1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePost', () => {
    it('should throw ForbiddenException when user is not the author', async () => {
      prisma.post.findUnique.mockResolvedValue({
        authorId: 'other-user',
        deletedAt: null,
      });

      await expect(
        service.updatePost('user1', 'post1', { content: 'new' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update post and emit PostUpdated event', async () => {
      prisma.post.findUnique.mockResolvedValue({
        authorId: 'user1',
        deletedAt: null,
      });
      prisma.post.update.mockResolvedValue({ id: 'post1', content: 'new' });
      prisma.postHashtag.findMany.mockResolvedValue([]);
      prisma.mention.deleteMany.mockResolvedValue({ count: 0 });

      await service.updatePost('user1', 'post1', { content: 'new' });

      expect(prisma.post.update).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'PostUpdated' }),
      );
    });
  });

  describe('deletePost', () => {
    it('should soft-delete post and emit PostDeleted event', async () => {
      prisma.post.findUnique.mockResolvedValue({
        authorId: 'user1',
        deletedAt: null,
      });
      prisma.post.update.mockResolvedValue({});

      await service.deletePost('user1', 'post1');

      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'PostDeleted' }),
      );
    });

    it('should throw ForbiddenException when user is not the author', async () => {
      prisma.post.findUnique.mockResolvedValue({
        authorId: 'other',
        deletedAt: null,
      });

      await expect(service.deletePost('user1', 'post1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addReaction', () => {
    it('should create new reaction and increment count', async () => {
      prisma.reaction.findFirst
        .mockResolvedValueOnce(null) // no same-type reaction
        .mockResolvedValueOnce(null); // no other reaction
      prisma.reaction.create.mockResolvedValue({ id: 'r1', type: 'LIKE' });
      prisma.post.update.mockResolvedValue({});

      const result = await service.addReaction('user1', 'post1', {
        type: 'LIKE',
      } as any);

      expect(result).not.toBeNull();
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reactionCount: { increment: 1 } },
        }),
      );
    });

    it('should toggle off when same reaction type exists', async () => {
      prisma.reaction.findFirst.mockResolvedValueOnce({
        id: 'r1',
        type: 'LIKE',
      });
      prisma.reaction.delete.mockResolvedValue({});
      prisma.post.update.mockResolvedValue({});

      const result = await service.addReaction('user1', 'post1', {
        type: 'LIKE',
      } as any);

      expect(result).toEqual({ action: 'removed', reaction: null });
      expect(prisma.reaction.delete).toHaveBeenCalled();
    });
  });

  describe('savePost / unsavePost', () => {
    it('should upsert savedPost', async () => {
      prisma.savedPost.upsert.mockResolvedValue({
        userId: 'user1',
        postId: 'post1',
      });

      await service.savePost('user1', 'post1');

      expect(prisma.savedPost.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_postId: { userId: 'user1', postId: 'post1' } },
        }),
      );
    });

    it('should soft-delete savedPost on unsave', async () => {
      prisma.savedPost.updateMany.mockResolvedValue({ count: 1 });

      await service.unsavePost('user1', 'post1');

      expect(prisma.savedPost.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
