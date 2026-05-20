import { Injectable } from '@nestjs/common';
import { ConnectionStatus, FollowStatus } from '@prisma/client';
import type { PrismaService } from '../infra/prisma/prisma.service';

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
}
