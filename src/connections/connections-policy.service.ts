import { Injectable } from '@nestjs/common';
import { ConnectionStatus, FollowStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import type { MutualConnectionRow } from './connections.service';

@Injectable()
export class ConnectionsPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns true if there is an ACCEPTED connection between userAId and userBId.
   */
  async areConnected(userAId: string, userBId: string): Promise<boolean> {
    const connection = await this.prisma.connection.findFirst({
      where: {
        status: ConnectionStatus.ACCEPTED,
        OR: [
          { requesterId: userAId, addresseeId: userBId },
          { requesterId: userBId, addresseeId: userAId },
        ],
      },
      select: { id: true },
    });
    return !!connection;
  }

  /**
   * Returns true if either user has blocked the other (bidirectional check).
   */
  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
      select: { id: true },
    });
    return !!block;
  }

  /**
   * Returns true if followerId is actively following followeeId.
   */
  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        followeeId,
        status: FollowStatus.ACTIVE,
      },
      select: { id: true },
    });
    return !!follow;
  }

  /**
   * Returns mutual connections between userId and targetUserId, filtering out
   * any users who have blocked — or been blocked by — the requesting user.
   *
   * This is the policy-enriched variant intended for use by other domains that
   * need visibility-safe mutual connection data.
   */
  async getMutualConnectionsWithPolicy(
    userId: string,
    targetUserId: string,
    query: { cursor?: string; limit?: number },
  ) {
    const limit = query.limit ?? 20;

    let cursorWhere = Prisma.empty;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = Prisma.sql`
          AND (c.created_at < ${decoded.createdAt} OR (c.created_at = ${decoded.createdAt} AND u.id < ${decoded.id}))
        `;
      }
    }

    const rows = await this.prisma.$queryRaw<MutualConnectionRow[]>(
      Prisma.sql`
        WITH user_blocks AS (
          SELECT blocked_id AS blocked_user_id FROM blocks WHERE blocker_id = ${userId}
          UNION
          SELECT blocker_id AS blocked_user_id FROM blocks WHERE blocked_id = ${userId}
        )
        SELECT
          u.id,
          p.first_name AS "firstName",
          p.last_name AS "lastName",
          p.headline,
          c.created_at AS "connectedAt"
        FROM connections c
        JOIN users u ON u.id = CASE
          WHEN c.requester_id = ${userId} THEN c.addressee_id
          ELSE c.requester_id
        END
        LEFT JOIN profiles p ON p.user_id = u.id AND p.deleted_at IS NULL
        WHERE (c.requester_id = ${userId} OR c.addressee_id = ${userId})
          AND c.status = 'ACCEPTED'
          AND u.id IN (
            SELECT CASE
              WHEN c2.requester_id = ${targetUserId} THEN c2.addressee_id
              ELSE c2.requester_id
            END
            FROM connections c2
            WHERE (c2.requester_id = ${targetUserId} OR c2.addressee_id = ${targetUserId})
              AND c2.status = 'ACCEPTED'
          )
          AND u.id <> ${userId}
          AND u.id <> ${targetUserId}
          AND u.id NOT IN (SELECT blocked_user_id FROM user_blocks)
          ${cursorWhere}
        ORDER BY c.created_at DESC, u.id DESC
        LIMIT ${limit + 1}
      `,
    );

    const hasNextPage = rows.length > limit;
    const items: MutualConnectionRow[] = hasNextPage
      ? rows.slice(0, limit)
      : rows;
    const last = items.at(-1);
    const nextCursor =
      hasNextPage && last ? encodeCursor(last.connectedAt, last.id) : undefined;

    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }
}
