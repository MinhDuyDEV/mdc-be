import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionStatus, FollowStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import { ConnectionsPolicyService } from './connections-policy.service';
import type { SendConnectionRequestDto } from './dto/send-connection-request.dto';
import {
  decodeCursor,
  encodeCursor,
  buildCursorWhere,
  paginateRows,
} from '../common/pagination/cursor';

const CONNECTION_INCLUDE = {
  requester: {
    select: {
      id: true,
      email: true,
      profile: {
        where: { deletedAt: null },
        select: { firstName: true, lastName: true, headline: true },
      },
    },
  },
  addressee: {
    select: {
      id: true,
      email: true,
      profile: {
        where: { deletedAt: null },
        select: { firstName: true, lastName: true, headline: true },
      },
    },
  },
} as const;

export interface MutualConnectionRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  connectedAt: Date;
}

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
    private readonly connectionsPolicy: ConnectionsPolicyService,
  ) {}

  // ─────────────────────── Connection requests ────────────────────────────

  async sendRequest(userId: string, dto: SendConnectionRequestDto) {
    if (userId === dto.toUserId) {
      throw new BadRequestException('CANNOT_CONNECT_TO_SELF');
    }

    // Check if either user blocked the other
    const blocked = await this.connectionsPolicy.isBlocked(
      userId,
      dto.toUserId,
    );
    if (blocked) {
      throw new BadRequestException('BLOCKED_USER');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        'Connection:sendRequest',
        `${userId}:${dto.toUserId}`,
      );

      // Check for existing connection (inside transaction to prevent race)
      const existing = await tx.connection.findFirst({
        where: {
          OR: [
            {
              requesterId: userId,
              addresseeId: dto.toUserId,
              status: {
                in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED],
              },
            },
            {
              requesterId: dto.toUserId,
              addresseeId: userId,
              status: {
                in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED],
              },
            },
          ],
        },
      });
      if (existing) {
        throw new ConflictException('CONNECTION_ALREADY_EXISTS');
      }

      const connection = await tx.connection.create({
        data: {
          requesterId: userId,
          addresseeId: dto.toUserId,
          status: ConnectionStatus.PENDING,
        },
        include: CONNECTION_INCLUDE,
      });

      await this.outboxService.emit(tx, {
        eventType: 'ConnectionRequested',
        aggregateType: 'Connection',
        aggregateId: connection.id,
        payload: {
          connectionId: connection.id,
          requesterUserId: userId,
          targetUserId: dto.toUserId,
        },
      });

      return connection;
    });
  }

  async acceptRequest(userId: string, connectionId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.addresseeId !== userId) {
      throw new NotFoundException('CONNECTION_NOT_FOUND');
    }

    if (connection.status !== ConnectionStatus.PENDING) {
      throw new BadRequestException('CONNECTION_NOT_PENDING');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.connection.update({
        where: { id: connectionId },
        data: { status: ConnectionStatus.ACCEPTED },
        include: CONNECTION_INCLUDE,
      });

      await this.outboxService.emit(tx, {
        eventType: 'ConnectionAccepted',
        aggregateType: 'Connection',
        aggregateId: updated.id,
        payload: {
          connectionId: updated.id,
          requesterUserId: connection.requesterId,
          targetUserId: userId,
        },
      });

      return updated;
    });
  }

  async declineRequest(userId: string, connectionId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.addresseeId !== userId) {
      throw new NotFoundException('CONNECTION_NOT_FOUND');
    }

    if (connection.status !== ConnectionStatus.PENDING) {
      throw new BadRequestException('CONNECTION_NOT_PENDING');
    }

    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.DECLINED },
      include: CONNECTION_INCLUDE,
    });
  }

  async removeConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('CONNECTION_NOT_FOUND');
    }

    // Either party can remove
    if (
      connection.requesterId !== userId &&
      connection.addresseeId !== userId
    ) {
      throw new NotFoundException('NOT_CONNECTION_PARTICIPANT');
    }

    if (connection.status !== ConnectionStatus.ACCEPTED) {
      throw new BadRequestException('CONNECTION_NOT_ACCEPTED');
    }

    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.REMOVED },
    });
  }

  // ─────────────────────── Connection listing ─────────────────────────────

  async listConnections(
    userId: string,
    query: { cursor?: string; limit?: number },
  ) {
    const limit = query.limit ?? 20;
    let cursorWhere: Prisma.ConnectionWhereInput = {};

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = buildCursorWhere(decoded);
      }
    }

    const rows = await this.prisma.connection.findMany({
      where: {
        AND: [
          {
            OR: [{ requesterId: userId }, { addresseeId: userId }],
            status: ConnectionStatus.ACCEPTED,
          },
          cursorWhere,
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: CONNECTION_INCLUDE,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  async listPendingRequests(
    userId: string,
    query: { cursor?: string; limit?: number },
  ) {
    const limit = query.limit ?? 20;
    let cursorWhere: Prisma.ConnectionWhereInput = {};

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        cursorWhere = buildCursorWhere(decoded);
      }
    }

    const rows = await this.prisma.connection.findMany({
      where: {
        AND: [
          {
            OR: [{ requesterId: userId }, { addresseeId: userId }],
            status: ConnectionStatus.PENDING,
          },
          cursorWhere,
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: CONNECTION_INCLUDE,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, limit);

    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  // ─────────────────────── Follows ────────────────────────────────────────

  async follow(userId: string, followeeId: string) {
    if (userId === followeeId) {
      throw new BadRequestException('CANNOT_FOLLOW_SELF');
    }

    const blocked = await this.connectionsPolicy.isBlocked(userId, followeeId);
    if (blocked) {
      throw new BadRequestException('BLOCKED_USER');
    }

    // Idempotent: reactivate if exists
    const existing = await this.prisma.follow.findFirst({
      where: { followerId: userId, followeeId },
    });

    if (existing) {
      if (existing.status === FollowStatus.ACTIVE) {
        return existing;
      }
      return this.prisma.follow.update({
        where: { id: existing.id },
        data: { status: FollowStatus.ACTIVE },
      });
    }

    try {
      return await this.prisma.follow.create({
        data: {
          followerId: userId,
          followeeId,
          status: FollowStatus.ACTIVE,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('FOLLOW_ALREADY_EXISTS');
      }
      throw err;
    }
  }

  async unfollow(userId: string, followeeId: string) {
    const follow = await this.prisma.follow.findFirst({
      where: { followerId: userId, followeeId, status: FollowStatus.ACTIVE },
    });

    if (!follow) {
      throw new NotFoundException('FOLLOW_NOT_FOUND');
    }

    return this.prisma.follow.update({
      where: { id: follow.id },
      data: { status: FollowStatus.INACTIVE },
    });
  }

  // ─────────────────────── Mutual connections ─────────────────────────────

  async getMutualConnections(
    userId: string,
    targetUserId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<{
    data: MutualConnectionRow[];
    meta: { nextCursor?: string; hasNextPage: boolean; limit: number };
  }> {
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
        SELECT
          u.id,
          u.email,
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
          ${cursorWhere}
        ORDER BY c.created_at DESC, u.id DESC
        LIMIT ${limit + 1}
      `,
    );

    const hasNextPage = rows.length > limit;
    const items: MutualConnectionRow[] = hasNextPage
      ? rows.slice(0, limit)
      : rows;
    let nextCursor: string | undefined;
    if (hasNextPage && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor(last.connectedAt, last.id);
    }

    return { data: items, meta: { nextCursor, hasNextPage, limit } };
  }

  async getMutualConnectionCount(
    userId: string,
    targetUserId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT u.id
          FROM connections c
          JOIN users u ON u.id = CASE
            WHEN c.requester_id = ${userId} THEN c.addressee_id
            ELSE c.requester_id
          END
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
        ) sub
      `,
    );

    return Number(rows[0]?.count ?? 0);
  }

  // ─────────────────────── Blocks ─────────────────────────────────────────

  async blockUser(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new BadRequestException('CANNOT_BLOCK_SELF');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.idempotencyService.claim(
        tx,
        'Connection:blockUser',
        `${userId}:${blockedUserId}`,
      );

      // Check for existing block (inside transaction to prevent race)
      const existing = await tx.block.findFirst({
        where: { blockerId: userId, blockedId: blockedUserId },
      });
      if (existing) {
        throw new ConflictException('BLOCK_ALREADY_EXISTS');
      }

      // Create block
      const block = await tx.block.create({
        data: {
          blockerId: userId,
          blockedId: blockedUserId,
        },
      });

      // Auto-remove any existing connections (both directions)
      await tx.connection.updateMany({
        where: {
          OR: [
            {
              requesterId: userId,
              addresseeId: blockedUserId,
              status: {
                in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED],
              },
            },
            {
              requesterId: blockedUserId,
              addresseeId: userId,
              status: {
                in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED],
              },
            },
          ],
        },
        data: { status: ConnectionStatus.REMOVED },
      });

      // Auto-deactivate any existing follows (both directions)
      await tx.follow.updateMany({
        where: {
          OR: [
            {
              followerId: userId,
              followeeId: blockedUserId,
              status: FollowStatus.ACTIVE,
            },
            {
              followerId: blockedUserId,
              followeeId: userId,
              status: FollowStatus.ACTIVE,
            },
          ],
        },
        data: { status: FollowStatus.INACTIVE },
      });

      await this.outboxService.emit(tx, {
        eventType: 'UserBlocked',
        aggregateType: 'Block',
        aggregateId: block.id,
        payload: {
          blockerUserId: userId,
          blockedUserId,
        },
      });

      return block;
    });
  }

  async unblockUser(userId: string, blockedUserId: string) {
    const block = await this.prisma.block.findFirst({
      where: { blockerId: userId, blockedId: blockedUserId },
    });

    if (!block) {
      throw new NotFoundException('BLOCK_NOT_FOUND');
    }

    await this.prisma.block.delete({
      where: { id: block.id },
    });
  }
}
