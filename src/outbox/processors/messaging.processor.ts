import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../idempotency.service';

interface MessageSentPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientIds: string[];
}

@Injectable()
export class MessagingProcessor {
  private readonly logger = new Logger(MessagingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async processMessageSent(payload: MessageSentPayload): Promise<void> {
    const { messageId, conversationId, senderId, recipientIds } = payload;

    // Verify message exists
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true },
    });

    if (!message) {
      this.logger.warn(
        `Message ${messageId} not found — skipping notification fan-out`,
      );
      return;
    }

    // Create notification for each recipient (except sender)
    for (const recipientId of recipientIds) {
      if (recipientId === senderId) continue;

      const key = `${recipientId}:MessageSent:${messageId}`;
      await this.idempotencyService.claim('Notification', key);

      // Check for duplicate (payloadJson will contain the messageId)
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: recipientId,
          type: 'NewMessage',
          payloadJson: { path: ['messageId'], equals: messageId },
        },
        select: { id: true },
      });

      if (existing) {
        this.logger.debug(
          `Notification already exists for ${recipientId} — skipping`,
        );
        continue;
      }

      // Create notification
      await this.prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'NewMessage',
          title: 'New message',
          body: 'You have a new message',
          actionUrl: `/conversations/${conversationId}`,
          payloadJson: {
            messageId,
            conversationId,
            senderId,
          },
        },
      });

      this.logger.debug(
        `Created NewMessage notification for user ${recipientId}`,
      );
    }
  }
}
