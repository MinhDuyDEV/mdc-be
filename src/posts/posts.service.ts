import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PostStatus, PostVisibility } from "@prisma/client";
import type { PrismaTransaction } from "../infra/prisma";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { IdempotencyService } from "../outbox/idempotency.service";
import type { OutboxService } from "../outbox/outbox.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import type { CreatePostDto } from "./dto/create-post.dto";
import { CreateReactionDto } from "./dto/create-reaction.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import type { UpdatePostDto } from "./dto/update-post.dto";
import { extractHashtags, extractMentions } from "./mention-hashtag.util";
import type { PostsPolicyService } from "./posts-policy.service";

const POST_INCLUDE = {
	author: {
		select: {
			id: true,
			email: true,
			profile: {
				select: { firstName: true, lastName: true, headline: true },
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
   * Create a post with mentions, hashtags, and media
   */
  async createPost(userId: string, dto: CreatePostDto) {
    await this.idempotencyService.claim('Post:create', `${userId}:${Date.now()}`);

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          authorId: userId,
          content: dto.content,
          visibility: dto.visibility ?? PostVisibility.PUBLIC,
          status: PostStatus.PUBLISHED,
        },
        include: POST_INCLUDE,
      });

      // Extract and link hashtags
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

      // Link media assets
      if (dto.mediaAssetIds?.length) {
        await tx.postMedia.createMany({
          data: dto.mediaAssetIds.map((mediaAssetId) => ({
            postId: post.id,
            mediaAssetId,
          })),
        });
      }

      // Extract and create mentions
      const mentions = extractMentions(dto.content);
      for (const username of mentions) {
        const mentionedUser = await tx.user.findUnique({
          where: { email: username },
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
          await this.outboxService.emit(tx as PrismaTransaction, {
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

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'PostCreated',
        aggregateType: 'Post',
        aggregateId: post.id,
        payload: {
          postId: post.id,
          authorId: userId,
          visibility: post.visibility,
        },
      });

      return post;
    });
  }

  /**
   * Get post by ID with visibility check
   */
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

  /**
   * Update post (author only)
   */
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

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'PostUpdated',
        aggregateType: 'Post',
        aggregateId: postId,
        payload: { postId, authorId: userId },
      });

      return updated;
    });
  }

  /**
   * Soft delete post (author only)
   */
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

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'PostDeleted',
        aggregateType: 'Post',
        aggregateId: postId,
        payload: { postId, authorId: userId },
      });
    });
  }

  /**
   * Create comment on a post
   */
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

      await this.outboxService.emit(tx as PrismaTransaction, {
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

  /**
   * Update comment (author only)
   */
  async updateComment(userId: string, commentId: string, dto: UpdateCommentDto) {
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

  /**
   * Soft delete comment (author or post author)
   */
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

  /**
   * Add or update reaction (toggle same type, replace different type)
   */
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
        // Same type = toggle off
        await tx.reaction.delete({ where: { id: existing.id } });
        await tx.post.update({
          where: { id: postId },
          data: { reactionCount: { decrement: 1 } },
        });
        return null;
      }

      const otherReaction = await tx.reaction.findFirst({
        where: { postId, authorId: userId },
      });

      if (otherReaction) {
        const updated = await tx.reaction.update({
          where: { id: otherReaction.id },
          data: { type: dto.type },
        });
        await this.outboxService.emit(tx as PrismaTransaction, {
          eventType: 'ReactionAdded',
          aggregateType: 'Reaction',
          aggregateId: updated.id,
          payload: { reactionId: updated.id, postId, authorId: userId, type: dto.type },
        });
        return updated;
      }

      const reaction = await tx.reaction.create({
        data: { postId, authorId: userId, type: dto.type },
      });

      await tx.post.update({
        where: { id: postId },
        data: { reactionCount: { increment: 1 } },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'ReactionAdded',
        aggregateType: 'Reaction',
        aggregateId: reaction.id,
        payload: { reactionId: reaction.id, postId, authorId: userId, type: dto.type },
      });

      return reaction;
    });
  }

  /**
   * Remove reaction
   */
  async removeReaction(userId: string, reactionId: string): Promise<void> {
    const reaction = await this.prisma.reaction.findUnique({
      where: { id: reactionId },
      select: { authorId: true, postId: true },
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
    });
  }

  /**
   * Save post (upsert with soft-delete restore)
   */
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

  /**
   * Unsave post (soft delete)
   */
  async unsavePost(userId: string, postId: string): Promise<void> {
    await this.prisma.savedPost.updateMany({
      where: { userId, postId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hide post
   */
  async hidePost(userId: string, postId: string) {
    return this.prisma.hiddenPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  }

  /**
   * Unhide post
   */
  async unhidePost(userId: string, postId: string): Promise<void> {
    await this.prisma.hiddenPost.deleteMany({
      where: { userId, postId },
    });
  }
}
