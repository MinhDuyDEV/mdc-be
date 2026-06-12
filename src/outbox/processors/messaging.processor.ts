import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ChatGateway } from '../../realtime/chat.gateway';
import { MessageEventDto } from '../../realtime/dto/message-event.dto';
import { NotificationEventDto } from '../../realtime/dto/notification-event.dto';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { IdempotencyService } from '../idempotency.service';

interface MessageSentPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientIds: string[];
}

interface MessageEditedPayload {
  messageId: string;
  conversationId: string;
  editorId: string;
}

interface MessageDeletedPayload {
  messageId: string;
  conversationId: string;
  deleterId: string;
}

@Injectable()
export class MessagingProcessor {
  private readonly logger = new Logger(MessagingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly chatGateway: ChatGateway,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async processMessageSent(payload: MessageSentPayload): Promise<void> {
    const { messageId, conversationId, senderId, recipientIds } = payload;

    // Verify message exists
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, content: true, senderId: true, createdAt: true },
    });

    if (!message) {
      this.logger.warn(
        `Message ${messageId} not found — skipping notification fan-out`,
      );
      return;
    }

    // Populate conversation search index (Gap 1)
    await this.upsertSearchIndex(messageId, conversationId, message.content);

    // Create notification for each recipient (except sender)
    for (const recipientId of recipientIds) {
      if (recipientId === senderId) continue;

      // Check for duplicate first (payloadJson will contain the messageId)
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

      const key = `${recipientId}:MessageSent:${messageId}`;
      await this.idempotencyService.claim('Notification', key);

      // Create notification
      const notification = await this.prisma.notification.create({
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

      // Push notification to recipient's user room
      const notificationEvent: NotificationEventDto = {
        id: notification.id,
        type: 'NewMessage',
        title: 'New message',
        body: 'You have a new message',
        actionUrl: `/conversations/${conversationId}`,
        createdAt: notification.createdAt,
      };
      this.realtimeGateway.pushNotification(recipientId, notificationEvent);

      this.logger.debug(
        `Created NewMessage notification for user ${recipientId}`,
      );
    }

    // Push message to conversation room once (after all notifications)
    const messageEvent: MessageEventDto = {
      id: messageId,
      conversationId,
      senderId,
      content: message.content,
      createdAt: message.createdAt,
    };
    this.chatGateway.pushMessage(conversationId, messageEvent);
  }

  async processMessageEdited(payload: MessageEditedPayload): Promise<void> {
    const { messageId, conversationId, editorId } = payload;

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, content: true },
    });

    if (!message) {
      this.logger.warn(
        `MessageEdited: message ${messageId} not found — skipping`,
      );
      return;
    }

    // Update conversation search index with new content (Gap 1)
    await this.upsertSearchIndex(messageId, conversationId, message.content);

    // Push realtime edit event to conversation room (Gap 2)
    this.chatGateway.pushMessageEdited(conversationId, messageId, editorId);

    this.logger.debug(
      `Processed MessageEdited: message=${messageId} conversation=${conversationId}`,
    );
  }

  async processMessageDeleted(payload: MessageDeletedPayload): Promise<void> {
    const { messageId, conversationId, deleterId } = payload;

    // Remove from conversation search index (Gap 1)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM conversation_search_index WHERE message_id = $1::uuid`,
      messageId,
    );

    // Push realtime delete event to conversation room (Gap 2)
    this.chatGateway.pushMessageDeleted(conversationId, messageId, deleterId);

    this.logger.debug(
      `Processed MessageDeleted: message=${messageId} conversation=${conversationId}`,
    );
  }

  /**
   * Upsert a row in conversation_search_index using PostgreSQL's
   * to_tsvector for full-text search support.
   */
  private async upsertSearchIndex(
    messageId: string,
    conversationId: string,
    content: string,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO conversation_search_index (id, conversation_id, message_id, text_content, created_at)
       SELECT gen_random_uuid(), $1::uuid, $2::uuid, to_tsvector('english', $3), NOW()
       ON CONFLICT (message_id)
       DO UPDATE SET text_content = to_tsvector('english', $3),
                     created_at = NOW()`,
      conversationId,
      messageId,
      content,
    );
  }
}
