import { Injectable } from '@nestjs/common';
import { ConnectionsPolicyService } from '../connections/connections-policy.service';
import { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class MessagingPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionsPolicy: ConnectionsPolicyService,
  ) {}

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
    const blocked = await this.connectionsPolicy.isBlocked(
      userId,
      targetUserId,
    );
    return !blocked;
  }

  async canSendMessage(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const isParticipant = await this.isActiveParticipant(
      userId,
      conversationId,
    );
    if (!isParticipant) return false;

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });

    for (const p of participants) {
      if (p.userId === userId) continue;
      const blocked = await this.connectionsPolicy.isBlocked(userId, p.userId);
      if (blocked) return false;
    }

    return true;
  }
}
