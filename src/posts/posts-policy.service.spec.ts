import { PostVisibility } from "@prisma/client";
import type { ConnectionsPolicyService } from "../connections/connections-policy.service";
import type { PrismaService } from "../infra/prisma/prisma.service";
import { PostsPolicyService } from "./posts-policy.service";

describe("PostsPolicyService", () => {
	let service: PostsPolicyService;
	let prisma: any;
	let connectionsPolicy: any;

	beforeEach(() => {
		prisma = {
			post: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
			},
		};
		connectionsPolicy = {
			isBlocked: jest.fn().mockResolvedValue(false),
			areConnected: jest.fn().mockResolvedValue(false),
		};
		service = new PostsPolicyService(
			prisma as unknown as PrismaService,
			connectionsPolicy as unknown as ConnectionsPolicyService,
		);
	});

	describe("canViewPost", () => {
		it("should allow PUBLIC post to unauthenticated user", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PUBLIC,
				deletedAt: null,
			});

			const result = await service.canViewPost(undefined, "post1");
			expect(result).toBe(true);
		});

		it("should block PUBLIC post if viewer is blocked", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PUBLIC,
				deletedAt: null,
			});
			connectionsPolicy.isBlocked.mockResolvedValue(true);

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(false);
		});

		it("should allow CONNECTIONS post to connected user", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.CONNECTIONS,
				deletedAt: null,
			});
			connectionsPolicy.areConnected.mockResolvedValue(true);

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(true);
		});

		it("should deny CONNECTIONS post to non-connected user", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.CONNECTIONS,
				deletedAt: null,
			});
			connectionsPolicy.areConnected.mockResolvedValue(false);

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(false);
		});

		it("should allow author to see their own PRIVATE post", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PRIVATE,
				deletedAt: null,
			});

			const result = await service.canViewPost("author1", "post1");
			expect(result).toBe(true);
		});

		it("should deny PRIVATE post to others", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PRIVATE,
				deletedAt: null,
			});

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(false);
		});

		it("should deny deleted post", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PUBLIC,
				deletedAt: new Date(),
			});

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(false);
		});

		it("should return false when post does not exist", async () => {
			prisma.post.findUnique.mockResolvedValue(null);

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(false);
		});

		it("should allow authenticated viewer to see PUBLIC post when not blocked", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PUBLIC,
				deletedAt: null,
			});
			connectionsPolicy.isBlocked.mockResolvedValue(false);

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(true);
		});

		it("should deny CONNECTIONS post to unauthenticated user", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.CONNECTIONS,
				deletedAt: null,
			});

			const result = await service.canViewPost(undefined, "post1");
			expect(result).toBe(false);
		});

		it("should deny PRIVATE post to unauthenticated user", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PRIVATE,
				deletedAt: null,
			});

			const result = await service.canViewPost(undefined, "post1");
			expect(result).toBe(false);
		});

		it("should deny CONNECTIONS post when viewer is blocked", async () => {
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.CONNECTIONS,
				deletedAt: null,
			});
			connectionsPolicy.isBlocked.mockResolvedValue(true);

			const result = await service.canViewPost("viewer1", "post1");
			expect(result).toBe(false);
		});
	});

	describe("filterVisiblePostIds", () => {
		it("should return only visible post IDs", async () => {
			prisma.post.findMany.mockResolvedValue([
				{ id: "post1", authorId: "author1", visibility: PostVisibility.PUBLIC },
				{
					id: "post2",
					authorId: "author2",
					visibility: PostVisibility.PRIVATE,
				},
			]);
			prisma.post.findUnique
				.mockResolvedValueOnce({
					authorId: "author1",
					visibility: PostVisibility.PUBLIC,
					deletedAt: null,
				})
				.mockResolvedValueOnce({
					authorId: "author2",
					visibility: PostVisibility.PRIVATE,
					deletedAt: null,
				});

			const result = await service.filterVisiblePostIds("viewer1", [
				"post1",
				"post2",
			]);
			expect(result).toEqual(["post1"]);
		});

		it("should return empty array when no posts are visible", async () => {
			prisma.post.findMany.mockResolvedValue([
				{
					id: "post1",
					authorId: "author1",
					visibility: PostVisibility.PRIVATE,
				},
			]);
			prisma.post.findUnique.mockResolvedValue({
				authorId: "author1",
				visibility: PostVisibility.PRIVATE,
				deletedAt: null,
			});

			const result = await service.filterVisiblePostIds("viewer1", ["post1"]);
			expect(result).toEqual([]);
		});

		it("should return empty array for empty input", async () => {
			prisma.post.findMany.mockResolvedValue([]);

			const result = await service.filterVisiblePostIds("viewer1", []);
			expect(result).toEqual([]);
		});
	});
});
