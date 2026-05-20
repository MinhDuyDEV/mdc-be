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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CreatePostDto } from './dto/create-post.dto';
import type { CreateReactionDto } from './dto/create-reaction.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import type { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(user.id, dto);
  }

  @Get(':id')
  @Public()
  async getPost(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.getPost(user?.id, postId);
  }

  @Patch(':id')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  async updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(user.id, postId, dto);
  }

  @Delete(':id')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    await this.postsService.deletePost(user.id, postId);
  }

  // Comments
  @Post(':id/comments')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.createComment(user.id, postId, dto);
  }

  @Patch('comments/:id')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  async updateComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.postsService.updateComment(user.id, commentId, dto);
  }

  @Delete('comments/:id')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) commentId: string,
  ) {
    await this.postsService.deleteComment(user.id, commentId);
  }

  // Reactions
  @Post(':id/reactions')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async addReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateReactionDto,
  ) {
    return this.postsService.addReaction(user.id, postId, dto);
  }

  @Delete('reactions/:id')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) reactionId: string,
  ) {
    await this.postsService.removeReaction(user.id, reactionId);
  }

  // Saved posts
  @Post(':id/save')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async savePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.savePost(user.id, postId);
  }

  @Delete(':id/save')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsavePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    await this.postsService.unsavePost(user.id, postId);
  }

  // Hidden posts
  @Post(':id/hide')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async hidePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.hidePost(user.id, postId);
  }

  @Delete(':id/hide')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unhidePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    await this.postsService.unhidePost(user.id, postId);
  }
}
