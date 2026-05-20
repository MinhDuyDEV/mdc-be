import {
	BadRequestException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import type { CursorPaginationQueryDto } from "../common/pagination/cursor-pagination.dto";
import type { PrismaTransaction } from "../infra/prisma";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { IdempotencyService } from "../outbox/idempotency.service";
import type { OutboxService } from "../outbox/outbox.service";
import type { RecruitingPolicyService } from "../recruiting/recruiting-policy.service";
import type { CreateConversationDto } from "./dto/create-conversation.dto";
import type { CreateRecruitingConversationDto } from "./dto/create-recruiting-conversation.dto";
import type { SendMessageDto } from "./dto/send-message.dto";
import type { MessagingPolicyService } from "./messaging-policy.service";

interface CursorPayload {
	createdAt: string;
	id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
	return Buffer.from(
		JSON.stringify({ createdAt: createdAt.toISOString(), id }),
	).toString("base64");
}

function decodeCursor(cursor: string): CursorPayload | null {
	try {
		const decoded = JSON.parse(
			Buffer.from(cursor, "base64").toString("utf8"),
		) as CursorPayload;
		if (!decoded?.createdAt || !decoded?.id) return null;
		return decoded;
	} catch {
		return null;
	}
}

@Injectable()
export class MessagingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
		private readonly idempotencyService: IdempotencyService,
		private readonly messagingPolicy: MessagingPolicyService,
		private readonly recruitingPolicy: RecruitingPolicyService,
	) {}

	async createConversation(userId: string, dto: CreateConversationDto) {
		const targetUserId = dto.participantIds[0];

		if (userId === targetUserId) {
			throw new BadRequestException("SELF_CONVERSATION");
		}

		const canCreate = await this.messagingPolicy.canCreateConversation(
			userId,
			targetUserId,
		);
		if (!canCreate) {
			throw new BadRequestException("BLOCKED_USER");
		}

		// Check for existing DIRECT conversation between these two users
		const existing = await this.prisma.conversation.findFirst({
			where: {
				type: "DIRECT",
				participants: {
					every: {
						userId: { in: [userId, targetUserId] },
					},
				},
			},
			include: { participants: true },
		});

		if (existing) {
			return existing;
		}

		await this.idempotencyService.claim(
			"Conversation:create",
			`${userId}:${targetUserId}`,
		);

		return this.prisma.$transaction(async (tx) => {
			const conversation = await tx.conversation.create({
				data: {
					type: "DIRECT",
					participants: {
						createMany: {
							data: [
								{ userId, role: "MEMBER" },
								{ userId: targetUserId, role: "MEMBER" },
							],
						},
					},
				},
				include: { participants: true },
			});

			await this.outboxService.emit(tx as PrismaTransaction, {
				eventType: "ConversationCreated",
				aggregateType: "Conversation",
				aggregateId: conversation.id,
				payload: {
					conversationId: conversation.id,
					participantIds: [userId, targetUserId],
				},
			});

			return conversation;
		});
	}

	async createRecruitingConversation(
		recruiterId: string,
		dto: CreateRecruitingConversationDto,
	) {
		if (recruiterId === dto.candidateUserId) {
			throw new BadRequestException("SELF_CONVERSATION");
		}

		const decision = await this.recruitingPolicy.canMessageCandidate(
			recruiterId,
			dto.candidateUserId,
		);

		if (!decision.allowed) {
			throw new ForbiddenException(decision.reason);
		}

		// Check for existing conversation
		const existing = await this.prisma.conversation.findFirst({
			where: {
				type: "DIRECT",
				participants: {
					every: {
						userId: { in: [recruiterId, dto.candidateUserId] },
					},
				},
			},
			include: { participants: true },
		});

		if (existing) {
			return existing;
		}

		await this.idempotencyService.claim(
			"Conversation:recruiting",
			`${recruiterId}:${dto.candidateUserId}`,
		);

		return this.prisma.$transaction(async (tx) => {
			const conversation = await tx.conversation.create({
				data: {
					type: "DIRECT",
					participants: {
						createMany: {
							data: [
								{ userId: recruiterId, role: "MEMBER" },
								{ userId: dto.candidateUserId, role: "MEMBER" },
							],
						},
					},
				},
				include: { participants: true },
			});

			await this.outboxService.emit(tx as PrismaTransaction, {
				eventType: "ConversationCreated",
				aggregateType: "Conversation",
				aggregateId: conversation.id,
				payload: {
					conversationId: conversation.id,
					participantIds: [recruiterId, dto.candidateUserId],
				},
			});

			return conversation;
		});
	}

	async listConversations(userId: string, query: CursorPaginationQueryDto) {
		const limit = Math.min(query.limit, 100);
		const where: Record<string, unknown> = {
			participants: {
				some: {
					userId,
					leftAt: null,
				},
			},
		};

		if (query.cursor) {
			const decoded = decodeCursor(query.cursor);
			if (decoded) {
				where.OR = [
					{
						lastMessageAt: { lt: new Date(decoded.createdAt) },
					},
					{
						lastMessageAt: new Date(decoded.createdAt),
						id: { lt: decoded.id },
					},
				];
			}
		}

		const conversations = await this.prisma.conversation.findMany({
			where,
			orderBy: [
				{ lastMessageAt: { sort: "desc", nulls: "last" } },
				{ id: "desc" },
			],
			take: limit + 1,
			include: {
				participants: {
					where: { leftAt: null },
					include: {
						user: {
							select: {
								id: true,
								email: true,
								profile: {
									select: { headline: true },
								},
							},
						},
					},
				},
			},
		});

		const hasNextPage = conversations.length > limit;
		const items = hasNextPage ? conversations.slice(0, limit) : conversations;

		const nextCursor =
			items.length > 0
				? encodeCursor(
						items[items.length - 1].lastMessageAt ??
							items[items.length - 1].createdAt,
						items[items.length - 1].id,
					)
				: undefined;

		return {
			data: items,
			meta: {
				nextCursor,
				hasNextPage,
				limit,
			},
		};
	}

	async getConversation(userId: string, conversationId: string) {
		const isActive = await this.messagingPolicy.isActiveParticipant(
			userId,
			conversationId,
		);
		if (!isActive) {
			throw new ForbiddenException("NOT_A_PARTICIPANT");
		}

		const conversation = await this.prisma.conversation.findUnique({
			where: { id: conversationId },
			include: {
				participants: {
					include: {
						user: {
							select: {
								id: true,
								email: true,
								profile: {
									select: { headline: true },
								},
							},
						},
					},
				},
			},
		});

		if (!conversation) {
			throw new BadRequestException("CONVERSATION_NOT_FOUND");
		}

		return conversation;
	}

	async sendMessage(
		userId: string,
		conversationId: string,
		dto: SendMessageDto,
	) {
		const isActive = await this.messagingPolicy.isActiveParticipant(
			userId,
			conversationId,
		);
		if (!isActive) {
			throw new ForbiddenException("NOT_A_PARTICIPANT");
		}

		// Get conversation to find other participants
		const conversation = await this.prisma.conversation.findUnique({
			where: { id: conversationId },
			include: {
				participants: {
					where: { leftAt: null },
					select: { userId: true },
				},
			},
		});

		if (!conversation) {
			throw new BadRequestException("CONVERSATION_NOT_FOUND");
		}

		const recipientIds = conversation.participants
			.map((p: { userId: string }) => p.userId)
			.filter((id: string) => id !== userId);

		return this.prisma.$transaction(async (tx) => {
			const message = await tx.message.create({
				data: {
					conversationId,
					senderId: userId,
					content: dto.content,
					type: "TEXT",
				},
			});

			// Update conversation denorm fields
			await tx.conversation.update({
				where: { id: conversationId },
				data: {
					lastMessageAt: message.createdAt,
					lastMessagePreview:
						dto.content.length > 500
							? dto.content.substring(0, 497) + "..."
							: dto.content,
				},
			});

			await this.outboxService.emit(tx as PrismaTransaction, {
				eventType: "MessageSent",
				aggregateType: "Conversation",
				aggregateId: conversationId,
				payload: {
					messageId: message.id,
					conversationId,
					senderId: userId,
					recipientIds,
				},
			});

			return message;
		});
	}

	async getMessages(
		userId: string,
		conversationId: string,
		query: CursorPaginationQueryDto,
	) {
		const isActive = await this.messagingPolicy.isActiveParticipant(
			userId,
			conversationId,
		);
		if (!isActive) {
			throw new ForbiddenException("NOT_A_PARTICIPANT");
		}

		const limit = Math.min(query.limit, 100);
		const where: Record<string, unknown> = {
			conversationId,
		};

		if (query.cursor) {
			const decoded = decodeCursor(query.cursor);
			if (decoded) {
				where.OR = [
					{ createdAt: { lt: new Date(decoded.createdAt) } },
					{
						createdAt: new Date(decoded.createdAt),
						id: { lt: decoded.id },
					},
				];
			}
		}

		const messages = await this.prisma.message.findMany({
			where,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: limit + 1,
			select: {
				id: true,
				conversationId: true,
				senderId: true,
				content: true,
				type: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		const hasNextPage = messages.length > limit;
		const items = hasNextPage ? messages.slice(0, limit) : messages;

		const nextCursor =
			items.length > 0
				? encodeCursor(
						items[items.length - 1].createdAt,
						items[items.length - 1].id,
					)
				: undefined;

		return {
			data: items,
			meta: {
				nextCursor,
				hasNextPage,
				limit,
			},
		};
	}

	async markRead(userId: string, conversationId: string) {
		const isActive = await this.messagingPolicy.isActiveParticipant(
			userId,
			conversationId,
		);
		if (!isActive) {
			throw new ForbiddenException("NOT_A_PARTICIPANT");
		}

		await this.prisma.conversationParticipant.update({
			where: {
				conversationId_userId: {
					conversationId,
					userId,
				},
			},
			data: { lastReadAt: new Date() },
		});

		return { ok: true };
	}
}
