import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import type { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { CreateRecruitingConversationDto } from './dto/create-recruiting-conversation.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

@Controller('conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.createConversation(user.id, dto);
  }

  @Post('recruiting')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createRecruitingConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecruitingConversationDto,
  ) {
    return this.messagingService.createRecruitingConversation(user.id, dto);
  }

  @Get()
  async listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.messagingService.listConversations(user.id, query);
  }

  @Get(':id')
  async getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagingService.getConversation(user.id, conversationId);
  }

  @Post(':id/messages')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(user.id, conversationId, dto);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.messagingService.getMessages(user.id, conversationId, query);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagingService.markRead(user.id, conversationId);
  }
}
