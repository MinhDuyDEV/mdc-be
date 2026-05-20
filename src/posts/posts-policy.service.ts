import { Injectable } from "@nestjs/common";
import { PostVisibility } from "@prisma/client";
import type { ConnectionsPolicyService } from "../connections/connections-policy.service";
import type { PrismaService } from "../infra/prisma/prisma.service";

@Injectable()
export class PostsPolicyService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly connectionsPolicy: ConnectionsPolicyService,
	) {}

	/**
	 * Check if viewerId can view a post based on visibility + blocks + connections
	 */
	async canViewPost(
		viewerId: string | undefined,
		postId: string,
	): Promise<boolean> {
		const post = await this.prisma.post.findUnique({
			where: { id: postId },
			select: { authorId: true, visibility: true, deletedAt: true },
		});

		if (!post || post.deletedAt) return false;

		// Public posts visible to all
		if (post.visibility === PostVisibility.PUBLIC) {
			// Check blocks if viewer is authenticated
			if (viewerId) {
				const blocked = await this.connectionsPolicy.isBlocked(
					viewerId,
					post.authorId,
				);
				return !blocked;
			}
			return true;
		}

		// Private/Connections posts require authentication
		if (!viewerId) return false;

		// Author can always see their own posts
		if (viewerId === post.authorId) return true;

		// Check blocks
		const blocked = await this.connectionsPolicy.isBlocked(
			viewerId,
			post.authorId,
		);
		if (blocked) return false;

		// CONNECTIONS visibility requires accepted connection
		if (post.visibility === PostVisibility.CONNECTIONS) {
			return this.connectionsPolicy.areConnected(viewerId, post.authorId);
		}

		// PRIVATE visibility — only author
		return false;
	}

	/**
	 * Batch check: filter post IDs by visibility
	 * Returns IDs that viewerId can see
	 */
	async filterVisiblePostIds(
		viewerId: string | undefined,
		postIds: string[],
	): Promise<string[]> {
		const posts = await this.prisma.post.findMany({
			where: { id: { in: postIds }, deletedAt: null },
			select: { id: true, authorId: true, visibility: true },
		});

		const visible: string[] = [];
		for (const post of posts) {
			const canView = await this.canViewPost(viewerId, post.id);
			if (canView) visible.push(post.id);
		}
		return visible;
	}
}
