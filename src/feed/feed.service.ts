import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  ConnectionStatus,
  FollowStatus,
  PostStatus,
  PostVisibility,
  type Prisma,
} from '@prisma/client';
import { ConnectionsPolicyService } from '../connections/connections-policy.service';
import { MAX_PAGE_LIMIT } from '../common/pagination/cursor-pagination.dto';
import {
  buildCursorWhere,
  decodeCursor,
  paginateRows,
} from '../common/pagination/cursor';
import type { AppConfig } from '../infra/config/app-config';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { FeedQueryDto } from './dto/feed-query.dto';
import { FeedSortOrder } from './dto/feed-query.dto';

const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      email: true,
      profile: {
        // Filter out soft-deleted profiles (e.g. removed by moderation
        // REMOVE_CONTENT) so readers never see a tombstoned profile's
        // name/headline alongside the post.
        where: { deletedAt: null },
        select: { firstName: true, lastName: true, headline: true },
      },
    },
  },
  hashtags: { include: { hashtag: { select: { name: true } } } },
  _count: {
    select: {
      reactions: true,
      comments: true,
    },
  },
} as const;

interface PostScoreInput {
  createdAt: Date;
  reactionCount: number;
  commentCount: number;
  authorId: string;
}

@Injectable()
export class FeedService {
  private readonly recencyWeight: number;
  private readonly engagementWeight: number;
  private readonly relationshipWeight: number;
  private readonly recencyDecayHours: number;
  private readonly rankBatchMultiplier: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionsPolicy: ConnectionsPolicyService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.recencyWeight = FeedService.configNumber(
      configService,
      'FEED_RANK_RECENCY_WEIGHT',
      0.4,
    );
    this.engagementWeight = FeedService.configNumber(
      configService,
      'FEED_RANK_ENGAGEMENT_WEIGHT',
      0.3,
    );
    this.relationshipWeight = FeedService.configNumber(
      configService,
      'FEED_RANK_RELATIONSHIP_WEIGHT',
      0.3,
    );
    this.recencyDecayHours = FeedService.configNumber(
      configService,
      'FEED_RANK_RECENCY_DECAY_HOURS',
      24,
    );
    this.rankBatchMultiplier = FeedService.configNumber(
      configService,
      'FEED_RANK_BATCH_MULTIPLIER',
      3,
    );
  }

  /** Type-safe read of a non-validated config key with a fallback default. */
  private static configNumber(
    cs: ConfigService<AppConfig, true>,
    key: string,
    fallback: number,
  ): number {
    const raw = cs.get(key as keyof AppConfig, { infer: true });

    return typeof raw === 'number' ? raw : fallback;
  }

  /**
   * Exponential-decay recency score based on hours since creation.
   * The decay half-life is controlled by `recencyDecayHours`.
   */
  private recencyScore(createdAt: Date): number {
    const hoursSinceCreation =
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    return Math.exp(-hoursSinceCreation / this.recencyDecayHours);
  }

  /**
   * Computes an engagement-weighted relevance score for a single post.
   * Higher values mean the post should appear earlier in a ranked feed.
   */
  private computeScore(
    post: PostScoreInput,
    viewerId: string | undefined,
    connectedIds: Set<string>,
    followedIds: Set<string>,
  ): number {
    const recency = this.recencyScore(post.createdAt);
    const engagement = (post.reactionCount * 2 + post.commentCount * 3) / 10;

    let relationship = 0.2;
    if (viewerId && post.authorId === viewerId) {
      relationship = 1.0;
    } else if (viewerId && connectedIds.has(post.authorId)) {
      relationship = 0.7;
    } else if (viewerId && followedIds.has(post.authorId)) {
      relationship = 0.4;
    }

    return (
      recency * this.recencyWeight +
      engagement * this.engagementWeight +
      relationship * this.relationshipWeight
    );
  }

  /**
   * Home feed: own posts + connections + follows, filtered by blocks.
   * Unauthenticated callers see only PUBLIC posts.
   * Supports `ranked` sort (engagement-weighted scoring) and `latest`/default (chronological).
   */
  async getHomeFeed(userId: string | undefined, query: FeedQueryDto) {
    const limit = query.limit ?? 20;

    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const cursorWhere =
      query.sort !== FeedSortOrder.RANKED && cursor
        ? buildCursorWhere(cursor)
        : {};

    // Hoist social-graph sets for scoring (populated when authenticated)
    let connectedIds = new Set<string>();
    let followedIds: string[] = [];

    let where: Prisma.PostWhereInput;

    if (userId) {
      // Bidirectional accepted connections, active follows, and blocks
      const [connections, follows, blocks] = await Promise.all([
        this.prisma.connection.findMany({
          where: {
            OR: [{ requesterId: userId }, { addresseeId: userId }],
            status: ConnectionStatus.ACCEPTED,
          },
          select: { requesterId: true, addresseeId: true },
        }),
        this.prisma.follow.findMany({
          where: { followerId: userId, status: FollowStatus.ACTIVE },
          select: { followeeId: true },
        }),
        this.prisma.block.findMany({
          where: {
            OR: [{ blockerId: userId }, { blockedId: userId }],
          },
          select: { blockerId: true, blockedId: true },
        }),
      ]);

      connectedIds = new Set<string>();
      for (const conn of connections) {
        connectedIds.add(
          conn.requesterId === userId ? conn.addresseeId : conn.requesterId,
        );
      }

      followedIds = follows.map((f) => f.followeeId);

      const blockedIds = new Set<string>();
      for (const block of blocks) {
        blockedIds.add(
          block.blockerId === userId ? block.blockedId : block.blockerId,
        );
      }

      // Filter out blocked users from connections and follows
      const visibleConnectedIds = Array.from(connectedIds).filter(
        (id) => !blockedIds.has(id),
      );
      const visibleFollowedIds = followedIds.filter(
        (id) => !blockedIds.has(id) && !connectedIds.has(id),
      );

      const or: Prisma.PostWhereInput[] = [
        // Own posts — no visibility restriction
        { authorId: userId },
      ];

      // Connections' posts — PUBLIC + CONNECTIONS only (blocks filtered out)
      if (visibleConnectedIds.length > 0) {
        or.push({
          authorId: { in: visibleConnectedIds },
          visibility: {
            in: [PostVisibility.PUBLIC, PostVisibility.CONNECTIONS],
          },
        });
      }

      // Followed users' posts — PUBLIC only (blocks and connections filtered out)
      if (visibleFollowedIds.length > 0) {
        or.push({
          authorId: { in: visibleFollowedIds },
          visibility: PostVisibility.PUBLIC,
        });
      }

      where = {
        AND: [
          {
            deletedAt: null,
            status: PostStatus.PUBLISHED,
            OR: or,
          },
          cursorWhere,
        ],
      };

      // Exclude posts the user has hidden
      const hiddenPosts = await this.prisma.hiddenPost.findMany({
        where: { userId },
        select: { postId: true },
      });
      if (hiddenPosts.length > 0) {
        const hiddenPostIds = hiddenPosts.map((h) => h.postId);
        // Push into AND so the notIn is always applied
        (where as Record<string, unknown>).AND = [
          ...((where as Record<string, unknown>).AND as unknown[]),
          { id: { notIn: hiddenPostIds } },
        ];
      }
    } else {
      where = {
        AND: [
          {
            deletedAt: null,
            status: PostStatus.PUBLISHED,
            visibility: PostVisibility.PUBLIC,
          },
          cursorWhere,
        ],
      };
    }

    // Ranked mode: fetch a larger batch, score, sort, then paginate in-memory
    if (query.sort === FeedSortOrder.RANKED) {
      const batchSize = Math.min(
        limit * this.rankBatchMultiplier,
        MAX_PAGE_LIMIT,
      );

      const rows = await this.prisma.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: batchSize,
        include: POST_INCLUDE,
      });

      const followedSet = new Set(followedIds);

      const scored = rows
        .map((post) => ({
          ...post,
          _score: this.computeScore(
            post as PostScoreInput,
            userId,
            connectedIds,
            followedSet,
          ),
        }))
        .sort((a, b) => b._score - a._score)
        .slice(0, limit + 1);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const items = scored.map(({ _score, ...rest }) => rest);
      const {
        items: paginatedItems,
        nextCursor,
        hasNextPage,
      } = paginateRows(items, limit);

      return { data: paginatedItems, meta: { nextCursor, hasNextPage, limit } };
    }

    // Chronological (latest / trending / default)
    const rows = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);
    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  /**
   * Profile feed: posts by a specific user, visibility-gated by viewer relationship.
   */
  async getProfileFeed(
    viewerId: string | undefined,
    userId: string,
    query: FeedQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const cursorWhere = cursor ? buildCursorWhere(cursor) : {};

    // Block check: if either party has blocked the other, return empty feed
    if (viewerId && viewerId !== userId) {
      const blocked = await this.connectionsPolicy.isBlocked(viewerId, userId);
      if (blocked) {
        return {
          data: [],
          meta: { nextCursor: undefined, hasNextPage: false, limit },
        };
      }
    }

    let isConnected = false;
    if (viewerId && viewerId !== userId) {
      isConnected = await this.connectionsPolicy.areConnected(viewerId, userId);
    }

    const visibilityFilter: Prisma.PostWhereInput =
      viewerId === userId
        ? {} // own profile — see everything
        : isConnected
          ? {
              visibility: {
                in: [PostVisibility.PUBLIC, PostVisibility.CONNECTIONS],
              },
            }
          : { visibility: PostVisibility.PUBLIC };

    const where: Prisma.PostWhereInput = {
      AND: [
        {
          authorId: userId,
          deletedAt: null,
          status: PostStatus.PUBLISHED,
          ...visibilityFilter,
        },
        cursorWhere,
      ],
    };

    const rows = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);
    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  /**
   * Company feed: PUBLIC posts from active company members.
   */
  async getCompanyFeed(companyId: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const cursorWhere = cursor ? buildCursorWhere(cursor) : {};

    const members = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    const where: Prisma.PostWhereInput = {
      AND: [
        {
          authorId: { in: memberIds },
          deletedAt: null,
          status: PostStatus.PUBLISHED,
          visibility: PostVisibility.PUBLIC,
        },
        cursorWhere,
      ],
    };

    const rows = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);
    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  /**
   * Hashtag feed: PUBLIC posts tagged with the given hashtag.
   */
  async getHashtagFeed(tag: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const cursorWhere = cursor ? buildCursorWhere(cursor) : {};

    const hashtag = await this.prisma.hashtag.findUnique({
      where: { name: tag.toLowerCase() },
    });

    if (!hashtag) {
      return {
        data: [],
        meta: { nextCursor: undefined, hasNextPage: false, limit },
      };
    }

    const where: Prisma.PostWhereInput = {
      AND: [
        {
          hashtags: { some: { hashtagId: hashtag.id } },
          deletedAt: null,
          status: PostStatus.PUBLISHED,
          visibility: PostVisibility.PUBLIC,
        },
        cursorWhere,
      ],
    };

    const rows = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);
    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  /**
   * Aggregates trending hashtag scores from posts published in the last 24 hours.
   * Runs every hour via cron. Score = reactionCount * 2 + commentCount * 3 + postCount.
   * Cleans up entries older than 7 days.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateTrendingHashtags() {
    const now = Date.now();
    const windowStart = new Date(now - 24 * 60 * 60 * 1000);
    const windowEnd = new Date();

    const posts = await this.prisma.post.findMany({
      where: {
        createdAt: { gte: windowStart },
        deletedAt: null,
        status: 'PUBLISHED' as const,
      },
      include: {
        hashtags: true,
        reactions: { select: { id: true } },
        comments: { select: { id: true } },
      },
    });

    // Group by hashtag and accumulate counts
    const hashtagScores = new Map<
      string,
      { postCount: number; reactionCount: number; commentCount: number }
    >();

    for (const post of posts) {
      const reactionCount = post.reactions.length;
      const commentCount = post.comments.length;
      for (const ph of post.hashtags) {
        const current = hashtagScores.get(ph.hashtagId) ?? {
          postCount: 0,
          reactionCount: 0,
          commentCount: 0,
        };
        current.postCount += 1;
        current.reactionCount += reactionCount;
        current.commentCount += commentCount;
        hashtagScores.set(ph.hashtagId, current);
      }
    }

    for (const [hashtagId, counts] of hashtagScores) {
      const score =
        counts.reactionCount * 2 + counts.commentCount * 3 + counts.postCount;
      if (score <= 0) continue;

      // Use findFirst + create/update instead of upsert with composite id
      // because the primary key is a UUID column.
      const existing = await this.prisma.trendingHashtag.findFirst({
        where: { hashtagId, windowStart },
      });

      if (existing) {
        await this.prisma.trendingHashtag.update({
          where: { id: existing.id },
          data: { score, windowEnd },
        });
      } else {
        await this.prisma.trendingHashtag.create({
          data: { hashtagId, score, windowStart, windowEnd },
        });
      }
    }

    // Clean up entries older than 7 days
    await this.prisma.trendingHashtag.deleteMany({
      where: {
        windowEnd: { lt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      },
    });
  }

  /**
   * Returns the top trending hashtags within the last 24 hours.
   */
  async getTrendingHashtags(limit = 10) {
    return this.prisma.trendingHashtag.findMany({
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        hashtag: { select: { id: true, name: true, postCount: true } },
      },
      where: {
        windowEnd: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
  }
}
