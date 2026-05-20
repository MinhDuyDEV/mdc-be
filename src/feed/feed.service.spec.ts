import { PostVisibility } from "@prisma/client";
import { FeedService } from "./feed.service";

describe("FeedService", () => {
	let service: FeedService;
	let prisma: any;
	let connectionsPolicy: any;

	beforeEach(() => {
		prisma = {
			post: { findMany: jest.fn() },
			connection: { findMany: jest.fn() },
			follow: { findMany: jest.fn() },
			block: { findMany: jest.fn() },
			companyMember: { findMany: jest.fn() },
			hashtag: { findUnique: jest.fn() },
		};
		connectionsPolicy = {
			areConnected: jest.fn().mockResolvedValue(false),
		};
		service = new FeedService(prisma, connectionsPolicy);
	});

	// ---------------------------------------------------------------------------
	// getHomeFeed
	// ---------------------------------------------------------------------------
	describe("getHomeFeed", () => {
		it("returns public posts for unauthenticated user without querying social graph", async () => {
			prisma.post.findMany.mockResolvedValue([
				{ id: "post1", createdAt: new Date() },
			]);

			const result = await service.getHomeFeed(undefined, { limit: 20 });

			expect(result.data).toHaveLength(1);
			expect(prisma.connection.findMany).not.toHaveBeenCalled();
			expect(prisma.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({ visibility: PostVisibility.PUBLIC }),
						]),
					}),
				}),
			);
		});

		it("queries social graph and filters by authorId for authenticated user", async () => {
			prisma.connection.findMany.mockResolvedValue([
				{ requesterId: "user1", addresseeId: "user2" },
			]);
			prisma.follow.findMany.mockResolvedValue([]);
			prisma.block.findMany.mockResolvedValue([]);
			prisma.post.findMany.mockResolvedValue([]);

			await service.getHomeFeed("user1", { limit: 20 });

			expect(prisma.connection.findMany).toHaveBeenCalled();
			expect(prisma.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								OR: expect.arrayContaining([
									expect.objectContaining({ authorId: "user1" }),
								]),
							}),
						]),
					}),
				}),
			);
		});

		it("excludes blocked users from visible author set", async () => {
			prisma.connection.findMany.mockResolvedValue([
				{ requesterId: "user1", addresseeId: "user2" },
			]);
			prisma.follow.findMany.mockResolvedValue([]);
			prisma.block.findMany.mockResolvedValue([
				{ blockerId: "user1", blockedId: "user2" },
			]);
			prisma.post.findMany.mockResolvedValue([]);

			await service.getHomeFeed("user1", { limit: 20 });

			const call = prisma.post.findMany.mock.calls[0][0];
			const orArray: Array<{ authorId?: string | { in?: string[] } }> =
				call.where.AND[0].OR;
			// Should have only self in OR (user2 blocked, no follows)
			expect(orArray).toHaveLength(1);
			expect(orArray[0].authorId).toBe("user1");
		});

		it("returns hasNextPage=true and nextCursor when more rows exist", async () => {
			const rows = Array.from({ length: 21 }, (_, i) => ({
				id: `post${i}`,
				createdAt: new Date(Date.now() - i * 1000),
			}));
			prisma.post.findMany.mockResolvedValue(rows);

			const result = await service.getHomeFeed(undefined, { limit: 20 });

			expect(result.data).toHaveLength(20);
			expect(result.meta.hasNextPage).toBe(true);
			expect(result.meta.nextCursor).toBeDefined();
		});
	});

	// ---------------------------------------------------------------------------
	// getProfileFeed
	// ---------------------------------------------------------------------------
	describe("getProfileFeed", () => {
		it("returns only PUBLIC posts for anonymous viewer", async () => {
			prisma.post.findMany.mockResolvedValue([]);

			await service.getProfileFeed(undefined, "user1", { limit: 20 });

			expect(prisma.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({ visibility: PostVisibility.PUBLIC }),
						]),
					}),
				}),
			);
		});

		it("returns PUBLIC + CONNECTIONS posts when viewer is connected", async () => {
			connectionsPolicy.areConnected.mockResolvedValue(true);
			prisma.post.findMany.mockResolvedValue([]);

			await service.getProfileFeed("viewer1", "user1", { limit: 20 });

			expect(prisma.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								visibility: {
									in: [PostVisibility.PUBLIC, PostVisibility.CONNECTIONS],
								},
							}),
						]),
					}),
				}),
			);
		});

		it("applies no visibility filter when viewer is the profile owner", async () => {
			prisma.post.findMany.mockResolvedValue([]);

			await service.getProfileFeed("user1", "user1", { limit: 20 });

			expect(connectionsPolicy.areConnected).not.toHaveBeenCalled();
			const call = prisma.post.findMany.mock.calls[0][0];
			expect(call.where.AND[0].visibility).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------------------
	// getCompanyFeed
	// ---------------------------------------------------------------------------
	describe("getCompanyFeed", () => {
		it("returns PUBLIC posts from active company members", async () => {
			prisma.companyMember.findMany.mockResolvedValue([{ userId: "member1" }]);
			prisma.post.findMany.mockResolvedValue([]);

			await service.getCompanyFeed("company1", { limit: 20 });

			expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { companyId: "company1", status: "active" },
				}),
			);
			expect(prisma.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								authorId: { in: ["member1"] },
								visibility: PostVisibility.PUBLIC,
							}),
						]),
					}),
				}),
			);
		});
	});

	// ---------------------------------------------------------------------------
	// getHashtagFeed
	// ---------------------------------------------------------------------------
	describe("getHashtagFeed", () => {
		it("returns empty result when hashtag does not exist", async () => {
			prisma.hashtag.findUnique.mockResolvedValue(null);

			const result = await service.getHashtagFeed("unknown", { limit: 20 });

			expect(result.data).toHaveLength(0);
			expect(result.meta.hasNextPage).toBe(false);
			expect(prisma.post.findMany).not.toHaveBeenCalled();
		});

		it("lowercases the tag before lookup", async () => {
			prisma.hashtag.findUnique.mockResolvedValue(null);

			await service.getHashtagFeed("NestJS", { limit: 20 });

			expect(prisma.hashtag.findUnique).toHaveBeenCalledWith({
				where: { name: "nestjs" },
			});
		});

		it("returns PUBLIC posts for existing hashtag", async () => {
			prisma.hashtag.findUnique.mockResolvedValue({
				id: "ht1",
				name: "nestjs",
			});
			prisma.post.findMany.mockResolvedValue([
				{ id: "post1", createdAt: new Date() },
			]);

			const result = await service.getHashtagFeed("nestjs", { limit: 20 });

			expect(result.data).toHaveLength(1);
			expect(prisma.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								hashtags: { some: { hashtagId: "ht1" } },
								visibility: PostVisibility.PUBLIC,
							}),
						]),
					}),
				}),
			);
		});
	});
});
