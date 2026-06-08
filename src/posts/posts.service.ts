import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, PostVisibility } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CreatePostDto } from './dto/create-post.dto';
import type { CreateReactionDto } from './dto/create-reaction.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import { extractHashtags, extractMentions } from './mention-hashtag.util';
import { PostsPolicyService } from './posts-policy.service';
import {
  buildCursorWhere,
  decodeCursor,
  paginateRows,
} from '../common/pagination/cursor';

const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      email: true,
      profile: {
        select: { headline: true },
      },
    },
  },
  hashtags: { include: { hashtag: { select: { name: true } } } },
  media: {
    include: {
      mediaAsset: { select: { id: true, url: true, type: true } },
    },
  },
} as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
    private readonly postsPolicy: PostsPolicyService,
  ) {}

  /**
   * Create a post with mentions, hashtags, and media.
   * Idempotency key derived from userId + content hash + visibility.
   */
  async createPost(userId: string, dto: CreatePostDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        'Post:create',
        `${userId}:${dto.content.slice(0, 100)}:${dto.visibility ?? 'PUBLIC'}`,
      );

      const post = await tx.post.create({
        data: {
          authorId: userId,
          content: dto.content,
          visibility: dto.visibility ?? PostVisibility.PUBLIC,
          status: PostStatus.PUBLISHED,
        },
        include: POST_INCLUDE,
      });

      const hashtags = extractHashtags(dto.content);
      for (const tagName of hashtags) {
        const hashtag = await tx.hashtag.upsert({
          where: { name: tagName },
          create: { name: tagName, postCount: 1 },
          update: { postCount: { increment: 1 } },
        });
        await tx.postHashtag.create({
          data: { postId: post.id, hashtagId: hashtag.id },
        });
      }

      if (dto.mediaAssetIds?.length) {
        await tx.postMedia.createMany({
          data: dto.mediaAssetIds.map((mediaAssetId) => ({
            postId: post.id,
            mediaAssetId,
          })),
        });
      }

      const mentions = extractMentions(dto.content);
      for (const username of mentions) {
        const mentionedUser = await tx.user.findFirst({
          where: { displayName: { equals: username, mode: 'insensitive' } },
          select: { id: true },
        });
        if (mentionedUser) {
          await tx.mention.create({
            data: {
              postId: post.id,
              mentionedUserId: mentionedUser.id,
              mentionerUserId: userId,
            },
          });
          await this.outboxService.emit(tx, {
            eventType: 'MentionCreated',
            aggregateType: 'Mention',
            aggregateId: post.id,
            payload: {
              postId: post.id,
              mentionedUserId: mentionedUser.id,
              mentionerUserId: userId,
            },
          });
        }
      }

      await this.outboxService.emit(tx, {
        eventType: 'PostCreated',
        aggregateType: 'Post',
        aggregateId: post.id,
        payload: {
          postId: post.id,
          authorId: userId,
          visibility: post.visibility,
        },
      });

      return tx.post.findUniqueOrThrow({
        where: { id: post.id },
        include: POST_INCLUDE,
      });
    });
  }

  async getPost(viewerId: string | undefined, postId: string) {
    const canView = await this.postsPolicy.canViewPost(viewerId, postId);
    if (!canView) {
      throw new NotFoundException('Post not found');
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: POST_INCLUDE,
    });

    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, deletedAt: true },
    });

    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('Not the post author');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          content: dto.content,
          visibility: dto.visibility,
        },
        include: POST_INCLUDE,
      });

      if (dto.content !== undefined) {
        const oldLinks = await tx.postHashtag.findMany({
          where: { postId },
          select: { hashtagId: true },
        });
        if (oldLinks.length > 0) {
          await tx.postHashtag.deleteMany({ where: { postId } });
          for (const link of oldLinks) {
            await tx.hashtag.update({
              where: { id: link.hashtagId },
              data: { postCount: { decrement: 1 } },
            });
          }
        }

        const hashtags = extractHashtags(dto.content);
        for (const tagName of hashtags) {
          const hashtag = await tx.hashtag.upsert({
            where: { name: tagName },
            create: { name: tagName, postCount: 1 },
            update: { postCount: { increment: 1 } },
          });
          await tx.postHashtag.create({
            data: { postId, hashtagId: hashtag.id },
          });
        }

        await tx.mention.deleteMany({ where: { postId } });
        const mentions = extractMentions(dto.content);
        for (const username of mentions) {
          const mentionedUser = await tx.user.findFirst({
            where: { displayName: { equals: username, mode: 'insensitive' } },
            select: { id: true },
          });
          if (mentionedUser) {
            await tx.mention.create({
              data: {
                postId,
                mentionedUserId: mentionedUser.id,
                mentionerUserId: userId,
              },
            });
            await this.outboxService.emit(tx, {
              eventType: 'MentionCreated',
              aggregateType: 'Mention',
              aggregateId: postId,
              payload: {
                postId,
                mentionedUserId: mentionedUser.id,
                mentionerUserId: userId,
              },
            });
          }
        }
      }

      await this.outboxService.emit(tx, {
        eventType: 'PostUpdated',
        aggregateType: 'Post',
        aggregateId: postId,
        payload: { postId, authorId: userId },
      });

      return updated;
    });
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, deletedAt: true },
    });

    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('Not the post author');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });

      await this.outboxService.emit(tx, {
        eventType: 'PostDeleted',
        aggregateType: 'Post',
        aggregateId: postId,
        payload: { postId, authorId: userId },
      });
    });
  }

  async listComments(
    viewerId: string | undefined,
    postId: string,
    limit: number,
    cursor?: string,
  ) {
    const canView = await this.postsPolicy.canViewPost(viewerId, postId);
    if (!canView) {
      throw new NotFoundException('Post not found');
    }

    const where: Record<string, unknown> = {
      postId,
      deletedAt: null,
      parentId: null,
    };

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        where.OR = buildCursorWhere(decoded).OR;
      }
    }

    const rows = await this.prisma.comment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        author: {
          select: { id: true, email: true, displayName: true },
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, email: true, displayName: true },
            },
          },
        },
      },
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    const canView = await this.postsPolicy.canViewPost(userId, postId);
    if (!canView) {
      throw new NotFoundException('Post not found');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { postId: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt || parent.postId !== postId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          postId,
          authorId: userId,
          parentId: dto.parentId,
          content: dto.content,
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      await this.outboxService.emit(tx, {
        eventType: 'CommentAdded',
        aggregateType: 'Comment',
        aggregateId: comment.id,
        payload: {
          commentId: comment.id,
          postId,
          authorId: userId,
          parentId: dto.parentId,
        },
      });

      return comment;
    });
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, deletedAt: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Not the comment author');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
    });
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, postId: true, deletedAt: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.prisma.post.findUnique({
      where: { id: comment.postId },
      select: { authorId: true },
    });

    if (comment.authorId !== userId && post?.authorId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });

      await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });
    });
  }

  async addReaction(userId: string, postId: string, dto: CreateReactionDto) {
    const canView = await this.postsPolicy.canViewPost(userId, postId);
    if (!canView) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findFirst({
        where: { postId, authorId: userId, type: dto.type },
      });

      if (existing) {
        await tx.reaction.delete({ where: { id: existing.id } });
        await tx.post.update({
          where: { id: postId },
          data: { reactionCount: { decrement: 1 } },
        });
        await this.outboxService.emit(tx, {
          eventType: 'ReactionRemoved',
          aggregateType: 'Reaction',
          aggregateId: existing.id,
          payload: {
            reactionId: existing.id,
            postId,
            authorId: userId,
            type: dto.type,
          },
        });
        return { action: 'removed' as const, reaction: null };
      }

      const otherReaction = await tx.reaction.findFirst({
        where: { postId, authorId: userId },
      });

      if (otherReaction) {
        const updated = await tx.reaction.update({
          where: { id: otherReaction.id },
          data: { type: dto.type },
        });
        await this.outboxService.emit(tx, {
          eventType: 'ReactionAdded',
          aggregateType: 'Reaction',
          aggregateId: updated.id,
          payload: {
            reactionId: updated.id,
            postId,
            authorId: userId,
            type: dto.type,
          },
        });
        return { action: 'updated' as const, reaction: updated };
      }

      const reaction = await tx.reaction.create({
        data: { postId, authorId: userId, type: dto.type },
      });

      await tx.post.update({
        where: { id: postId },
        data: { reactionCount: { increment: 1 } },
      });

      await this.outboxService.emit(tx, {
        eventType: 'ReactionAdded',
        aggregateType: 'Reaction',
        aggregateId: reaction.id,
        payload: {
          reactionId: reaction.id,
          postId,
          authorId: userId,
          type: dto.type,
        },
      });

      return { action: 'created' as const, reaction };
    });
  }

  async removeReaction(userId: string, reactionId: string): Promise<void> {
    const reaction = await this.prisma.reaction.findUnique({
      where: { id: reactionId },
      select: { authorId: true, postId: true, type: true },
    });

    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }

    if (reaction.authorId !== userId) {
      throw new ForbiddenException('Not your reaction');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reaction.delete({ where: { id: reactionId } });
      await tx.post.update({
        where: { id: reaction.postId },
        data: { reactionCount: { decrement: 1 } },
      });
      await this.outboxService.emit(tx, {
        eventType: 'ReactionRemoved',
        aggregateType: 'Reaction',
        aggregateId: reactionId,
        payload: {
          reactionId,
          postId: reaction.postId,
          authorId: userId,
          type: reaction.type,
        },
      });
    });
  }

  async savePost(userId: string, postId: string) {
    const canView = await this.postsPolicy.canViewPost(userId, postId);
    if (!canView) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: { deletedAt: null },
    });
  }

  async unsavePost(userId: string, postId: string): Promise<void> {
    await this.prisma.savedPost.updateMany({
      where: { userId, postId },
      data: { deletedAt: new Date() },
    });
  }

  async hidePost(userId: string, postId: string) {
    return this.prisma.hiddenPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  }

  async unhidePost(userId: string, postId: string): Promise<void> {
    await this.prisma.hiddenPost.deleteMany({
      where: { userId, postId },
    });
  }
}
