import { Injectable } from '@nestjs/common';
import {
  ConnectionStatus,
  FollowStatus,
  PostStatus,
  PostVisibility,
  type Prisma,
} from '@prisma/client';
import type { ConnectionsPolicyService } from '../connections/connections-policy.service';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { FeedQueryDto } from './dto/feed-query.dto';

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
  ).toString('base64');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as { createdAt?: string; id?: string };
    if (!decoded?.createdAt || !decoded?.id) return null;
    return { createdAt: new Date(decoded.createdAt), id: decoded.id };
  } catch {
    return null;
  }
}

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

    const cursorWhere = buildCursorWhere(query.cursor);

    let where: Prisma.PostWhereInput;

    if (userId) {
      // Bidirectional accepted connections
      const connections = await this.prisma.connection.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
          status: ConnectionStatus.ACCEPTED,
        },
        select: { requesterId: true, addresseeId: true },
      });
      const connectedIds = new Set<string>();
      for (const conn of connections) {
        connectedIds.add(
          conn.requesterId === userId ? conn.addresseeId : conn.requesterId,
        );
      }

      // Active follows
      const follows = await this.prisma.follow.findMany({
        where: { followerId: userId, status: FollowStatus.ACTIVE },
        select: { followeeId: true },
      });
      const followedIds = follows.map((f) => f.followeeId);

      // Bidirectional blocks
      const blocks = await this.prisma.block.findMany({
        where: {
          OR: [{ blockerId: userId }, { blockedId: userId }],
        },
        select: { blockerId: true, blockedId: true },
      });
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

    return paginateRows(rows, limit);
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
    const cursorWhere = buildCursorWhere(query.cursor);

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

    return paginateRows(rows, limit);
  }

  /**
   * Company feed: PUBLIC posts from active company members.
   */
  async getCompanyFeed(companyId: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const cursorWhere = buildCursorWhere(query.cursor);

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

    return paginateRows(rows, limit);
  }

  /**
   * Hashtag feed: PUBLIC posts tagged with the given hashtag.
   */
  async getHashtagFeed(tag: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const cursorWhere = buildCursorWhere(query.cursor);

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

    return paginateRows(rows, limit);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCursorWhere(cursor?: string): Prisma.PostWhereInput {
  if (!cursor) return {};
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  return {
    OR: [
      { createdAt: { lt: decoded.createdAt } },
      {
        AND: [{ createdAt: decoded.createdAt }, { id: { lt: decoded.id } }],
      },
    ],
  };
}

function paginateRows<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor(last.createdAt, last.id) : undefined;
  return { data: items, meta: { nextCursor, hasNextPage: hasMore, limit } };
}
