import { Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SearchIndexService } from '../../search/search-index.service';

@Injectable()
export class PostSearchIndexProcessor {
  private readonly logger = new Logger(PostSearchIndexProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  async processPostCreated(payload: { postId: string }): Promise<void> {
    await this.indexPost(payload.postId, 'PostCreated');
  }

  async processPostUpdated(payload: { postId: string }): Promise<void> {
    await this.indexPost(payload.postId, 'PostUpdated');
  }

  async processPostDeleted(payload: { postId: string }): Promise<void> {
    await this.searchIndex.deleteByQuery('posts', {
      term: { id: payload.postId },
    });
    this.logger.log(`Removed post ${payload.postId} from ES`);
  }

  private async indexPost(postId: string, eventType: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true, displayName: true },
        },
        hashtags: {
          include: {
            hashtag: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!post || post.deletedAt) {
      this.logger.warn(
        `Post ${postId} not found or deleted for ${eventType} — skipping`,
      );
      if (post?.deletedAt) {
        await this.searchIndex.deleteByQuery('posts', { term: { id: postId } });
      }
      return;
    }

    const hashtagNames = post.hashtags.map((ph) => ph.hashtag.name);

    await this.searchIndex.indexDocument('posts', post.id, {
      id: post.id,
      authorId: post.authorId,
      authorName: post.author.displayName,
      content: post.content,
      hashtags: hashtagNames,
      visibility: post.visibility,
      reactionCount: post.reactionCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    });

    if (!post || post.deletedAt) {
      this.logger.warn(
        `Post ${postId} not found or deleted for ${eventType} — skipping`,
      );
      if (post?.deletedAt) {
        await this.searchIndex.deleteByQuery('posts', { term: { id: postId } });
      }
      return;
    }

    await this.searchIndex.indexDocument('posts', post.id, {
      id: post.id,
      authorId: post.authorId,
      authorName: post.author.displayName,
      content: post.content,
      hashtags: hashtagNames,
      visibility: post.visibility,
      reactionCount: post.reactionCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    });

    this.logger.log(`Indexed post ${postId} in ES (${eventType})`);
  }
}
