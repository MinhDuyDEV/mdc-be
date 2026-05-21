import type { ConnectionsPolicyService } from "../connections/connections-policy.service";
import type { PrismaService } from "../infra/prisma/prisma.service";
import { MessagingPolicyService } from "./messaging-policy.service";

describe("MessagingPolicyService", () => {
	let prisma: any;
	let connectionsPolicy: any;
	let service: MessagingPolicyService;

	beforeEach(() => {
		prisma = {
			conversationParticipant: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
		};
		connectionsPolicy = {
			isBlocked: jest.fn().mockResolvedValue(false),
		};
		service = new MessagingPolicyService(
			prisma as PrismaService,
			connectionsPolicy as ConnectionsPolicyService,
		);
	});

	describe("isActiveParticipant", () => {
		it("returns true when user is active participant", async () => {
			prisma.conversationParticipant.findFirst.mockResolvedValue({
				id: "participant-1",
			});
			const result = await service.isActiveParticipant("user-1", "conv-1");
			expect(result).toBe(true);
		});

		it("returns false when user is not participant", async () => {
			prisma.conversationParticipant.findFirst.mockResolvedValue(null);
			const result = await service.isActiveParticipant("user-1", "conv-1");
			expect(result).toBe(false);
		});

		it("returns false when user has left conversation", async () => {
			prisma.conversationParticipant.findFirst.mockResolvedValue(null);
			const result = await service.isActiveParticipant("user-1", "conv-1");
			expect(result).toBe(false);
		});
	});

	describe("canCreateConversation", () => {
		it("returns true when users are not blocked", async () => {
			connectionsPolicy.isBlocked.mockResolvedValue(false);
			const result = await service.canCreateConversation("user-1", "user-2");
			expect(result).toBe(true);
			expect(connectionsPolicy.isBlocked).toHaveBeenCalledWith(
				"user-1",
				"user-2",
			);
		});

		it("returns false when either user blocked the other", async () => {
			connectionsPolicy.isBlocked.mockResolvedValue(true);
			const result = await service.canCreateConversation("user-1", "user-2");
			expect(result).toBe(false);
		});
	});

	describe("canSendMessage", () => {
		it("returns false when user is not active participant", async () => {
			prisma.conversationParticipant.findFirst.mockResolvedValue(null);
			const result = await service.canSendMessage("user-1", "conv-1");
			expect(result).toBe(false);
			expect(prisma.conversationParticipant.findMany).not.toHaveBeenCalled();
		});

		it("returns true when active and not blocked", async () => {
			prisma.conversationParticipant.findFirst.mockResolvedValue({
				id: "p-1",
			});
			prisma.conversationParticipant.findMany.mockResolvedValue([
				{ userId: "user-1" },
				{ userId: "user-2" },
			]);
			connectionsPolicy.isBlocked.mockResolvedValue(false);

			const result = await service.canSendMessage("user-1", "conv-1");
			expect(result).toBe(true);
			expect(connectionsPolicy.isBlocked).toHaveBeenCalledWith(
				"user-1",
				"user-2",
			);
		});

		it("returns false when blocked by other participant", async () => {
			prisma.conversationParticipant.findFirst.mockResolvedValue({
				id: "p-1",
			});
			prisma.conversationParticipant.findMany.mockResolvedValue([
				{ userId: "user-1" },
				{ userId: "user-2" },
				{ userId: "user-3" },
			]);
			connectionsPolicy.isBlocked
				.mockResolvedValueOnce(false) // user-1 vs user-2
				.mockResolvedValueOnce(true); // user-1 vs user-3

			const result = await service.canSendMessage("user-1", "conv-1");
			expect(result).toBe(false);
		});
	});
});
