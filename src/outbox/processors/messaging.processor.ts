import { Injectable, Logger } from "@nestjs/common";
import type { PrismaService } from "../../infra/prisma/prisma.service";
import type { ChatGateway } from "../../realtime/chat.gateway";
import type { MessageEventDto } from "../../realtime/dto/message-event.dto";
import type { NotificationEventDto } from "../../realtime/dto/notification-event.dto";
import type { RealtimeGateway } from "../../realtime/realtime.gateway";
import type { IdempotencyService } from "../idempotency.service";

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

		// Create notification for each recipient (except sender)
		for (const recipientId of recipientIds) {
			if (recipientId === senderId) continue;

			const key = `${recipientId}:MessageSent:${messageId}`;
			await this.idempotencyService.claim("Notification", key);

			// Check for duplicate (payloadJson will contain the messageId)
			const existing = await this.prisma.notification.findFirst({
				where: {
					userId: recipientId,
					type: "NewMessage",
					payloadJson: { path: ["messageId"], equals: messageId },
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
			const notification = await this.prisma.notification.create({
				data: {
					userId: recipientId,
					type: "NewMessage",
					title: "New message",
					body: "You have a new message",
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
				type: "NewMessage",
				title: "New message",
				body: "You have a new message",
				actionUrl: `/conversations/${conversationId}`,
				createdAt: notification.createdAt,
			};
			this.realtimeGateway.pushNotification(recipientId, notificationEvent);

			this.logger.debug(
				`Created NewMessage notification for user ${recipientId}`,
			);

			// Push message to conversation room (for online participants)
			const messageEvent: MessageEventDto = {
				id: messageId,
				conversationId,
				senderId,
				content: message.content,
				createdAt: message.createdAt,
			};
			this.chatGateway.pushMessage(conversationId, messageEvent);
		}
	}
}
