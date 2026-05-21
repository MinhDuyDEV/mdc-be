import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class MessagingPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async isActiveParticipant(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        userId,
        conversationId,
        leftAt: null,
      },
      select: { id: true },
    });
    return !!participant;
  }

  async canCreateConversation(
    userId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: userId },
        ],
      },
      select: { id: true },
    });
    return !block;
  }
}
