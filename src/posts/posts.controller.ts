import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { Public } from "../common/auth/public.decorator";
import type { CreateCommentDto } from "./dto/create-comment.dto";
import type { CreatePostDto } from "./dto/create-post.dto";
import type { CreateReactionDto } from "./dto/create-reaction.dto";
import type { UpdateCommentDto } from "./dto/update-comment.dto";
import type { UpdatePostDto } from "./dto/update-post.dto";
import type { PostsService } from "./posts.service";

@Controller("posts")
export class PostsController {
	constructor(private readonly postsService: PostsService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	async createPost(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreatePostDto,
	) {
		return this.postsService.createPost(user.id, dto);
	}

	@Get(":id")
	@Public()
	async getPost(
		@CurrentUser() user: AuthenticatedUser | undefined,
		@Param('id', ParseUUIDPipe) postId: string,
	) {
		return this.postsService.getPost(user?.id, postId);
	}

	@Patch(":id")
	async updatePost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
		@Body() dto: UpdatePostDto,
	) {
		return this.postsService.updatePost(user.id, postId, dto);
	}

	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async deletePost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
	) {
		await this.postsService.deletePost(user.id, postId);
	}

	// Comments
	@Post(":id/comments")
	@HttpCode(HttpStatus.CREATED)
	async createComment(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
		@Body() dto: CreateCommentDto,
	) {
		return this.postsService.createComment(user.id, postId, dto);
	}

	@Patch("comments/:id")
	async updateComment(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) commentId: string,
		@Body() dto: UpdateCommentDto,
	) {
		return this.postsService.updateComment(user.id, commentId, dto);
	}

	@Delete("comments/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteComment(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) commentId: string,
	) {
		await this.postsService.deleteComment(user.id, commentId);
	}

	// Reactions
	@Post(":id/reactions")
	@HttpCode(HttpStatus.CREATED)
	async addReaction(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
		@Body() dto: CreateReactionDto,
	) {
		return this.postsService.addReaction(user.id, postId, dto);
	}

	@Delete("reactions/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeReaction(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) reactionId: string,
	) {
		await this.postsService.removeReaction(user.id, reactionId);
	}

	// Saved posts
	@Post(":id/save")
	@HttpCode(HttpStatus.CREATED)
	async savePost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
	) {
		return this.postsService.savePost(user.id, postId);
	}

	@Delete(":id/save")
	@HttpCode(HttpStatus.NO_CONTENT)
	async unsavePost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
	) {
		await this.postsService.unsavePost(user.id, postId);
	}

	// Hidden posts
	@Post(":id/hide")
	@HttpCode(HttpStatus.CREATED)
	async hidePost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
	) {
		return this.postsService.hidePost(user.id, postId);
	}

	@Delete(":id/hide")
	@HttpCode(HttpStatus.NO_CONTENT)
	async unhidePost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id', ParseUUIDPipe) postId: string,
	) {
		await this.postsService.unhidePost(user.id, postId);
	}
}
