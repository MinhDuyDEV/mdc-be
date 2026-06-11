import { Injectable } from '@nestjs/common';
import {
  ConnectionStatus,
  FollowStatus,
  PostStatus,
  PostVisibility,
  type Prisma,
} from '@prisma/client';
import { ConnectionsPolicyService } from '../connections/connections-policy.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { FeedQueryDto } from './dto/feed-query.dto';
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
        // Filter out soft-deleted profiles (e.g. removed by moderation
        // REMOVE_CONTENT) so readers never see a tombstoned profile's
        // name/headline alongside the post.
        where: { deletedAt: null },
        select: { firstName: true, lastName: true, headline: true },
      },
    },
  },
  hashtags: { include: { hashtag: { select: { name: true } } } },
} as const;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionsPolicy: ConnectionsPolicyService,
  ) {}

  /**
   * Home feed: own posts + connections + follows, filtered by blocks.
   * Unauthenticated callers see only PUBLIC posts.
   */
  async getHomeFeed(userId: string | undefined, query: FeedQueryDto) {
    const limit = query.limit ?? 20;

    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const cursorWhere = cursor ? buildCursorWhere(cursor) : {};

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

      const connectedIds = new Set<string>();
      for (const conn of connections) {
        connectedIds.add(
          conn.requesterId === userId ? conn.addresseeId : conn.requesterId,
        );
      }

      const followedIds = follows.map((f) => f.followeeId);

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
}
