import { Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { IdempotencyService } from '../idempotency.service';

interface PostCreatedPayload {
  postId: string;
  authorId: string;
  visibility: string;
}

interface CommentAddedPayload {
  commentId: string;
  postId: string;
  authorId: string;
}

interface ReactionAddedPayload {
  reactionId: string;
  postId: string;
  authorId: string;
  type: string;
}

interface MentionCreatedPayload {
  postId: string;
  mentionedUserId: string;
  mentionerUserId: string;
}

@Injectable()
export class PostInteractionProcessor {
  private readonly logger = new Logger(PostInteractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async processPostCreated(payload: PostCreatedPayload): Promise<void> {
    // No notification fan-out for PostCreated in Phase 6.
    // Future: fan out to followers when follower-based notifications are implemented.
    this.logger.debug(
      `PostCreated: post=${payload.postId} by author=${payload.authorId} (Phase 6 — no fan-out)`,
    );
    await Promise.resolve(); // placeholder for future async fan-out
  }

  async processCommentAdded(payload: CommentAddedPayload): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: payload.postId },
      select: { authorId: true },
    });

    if (!post) {
      this.logger.warn(
        `CommentAdded: post ${payload.postId} not found — skipping`,
      );
      return;
    }

    // Don't notify yourself
    if (post.authorId === payload.authorId) {
      this.logger.debug(
        `CommentAdded: comment=${payload.commentId} by author on own post — skipping`,
      );
      return;
    }

    const created = await this.insertNotification({
      recipientUserId: post.authorId,
      eventType: 'CommentAdded',
      aggregateId: payload.postId,
      type: 'PostCommented',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'New comment on your post',
      body: 'Someone commented on your post',
      actionUrl: `/posts/${payload.postId}`,
      aggregateIdJsonField: 'postId',
    });

    this.logger.debug(
      `CommentAdded: ${created ? 'inserted' : 'skipped'} notification for post author=${post.authorId}`,
    );
  }

  async processReactionAdded(payload: ReactionAddedPayload): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: payload.postId },
      select: { authorId: true },
    });

    if (!post) {
      this.logger.warn(
        `ReactionAdded: post ${payload.postId} not found — skipping`,
      );
      return;
    }

    // Don't notify yourself
    if (post.authorId === payload.authorId) {
      this.logger.debug(
        `ReactionAdded: reaction=${payload.reactionId} by author on own post — skipping`,
      );
      return;
    }

    const reactionType =
      payload.type.charAt(0).toUpperCase() +
      payload.type.slice(1).toLowerCase();

    const created = await this.insertNotification({
      recipientUserId: post.authorId,
      eventType: 'ReactionAdded',
      aggregateId: payload.postId,
      type: 'PostLiked',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: `New ${reactionType} on your post`,
      body: `Someone reacted with ${reactionType} on your post`,
      actionUrl: `/posts/${payload.postId}`,
      aggregateIdJsonField: 'postId',
    });

    this.logger.debug(
      `ReactionAdded: ${created ? 'inserted' : 'skipped'} notification for post author=${post.authorId}`,
    );
  }

  async processMentionCreated(payload: MentionCreatedPayload): Promise<void> {
    const created = await this.insertNotification({
      recipientUserId: payload.mentionedUserId,
      eventType: 'MentionCreated',
      aggregateId: payload.postId,
      type: 'MentionedInPost',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'You were mentioned in a post',
      body: 'Someone mentioned you in their post',
      actionUrl: `/posts/${payload.postId}`,
      aggregateIdJsonField: 'postId',
    });

    this.logger.debug(
      `MentionCreated: ${created ? 'inserted' : 'skipped'} notification for mentioned user=${payload.mentionedUserId}`,
    );
  }

  private async insertNotification(opts: {
    recipientUserId: string;
    eventType: string;
    aggregateId: string;
    type: string;
    payloadJson: Record<string, unknown>;
    title: string;
    body: string;
    actionUrl: string;
    aggregateIdJsonField?: string;
  }): Promise<boolean> {
    const key = `${opts.recipientUserId}:${opts.eventType}:${opts.aggregateId}`;

    await this.idempotencyService.claim('Notification', key);

    const where: Record<string, unknown> = {
      userId: opts.recipientUserId,
      type: opts.type,
    };

    if (opts.aggregateIdJsonField && opts.aggregateId) {
      where.payloadJson = {
        path: [opts.aggregateIdJsonField],
        equals: opts.aggregateId,
      };
    }

    const existing = await this.prisma.notification.findFirst({
      where,
      select: { id: true },
    });

    if (existing) {
      this.logger.debug(`Skipping duplicate notification for key=${key}`);
      return false;
    }

    await this.prisma.notification.create({
      data: {
        userId: opts.recipientUserId,
        type: opts.type as Parameters<
          typeof this.prisma.notification.create
        >[0]['data']['type'],
        payloadJson: opts.payloadJson as Parameters<
          typeof this.prisma.notification.create
        >[0]['data']['payloadJson'],
        title: opts.title,
        body: opts.body,
        actionUrl: opts.actionUrl,
      },
    });

    return true;
  }
}
