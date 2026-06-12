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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { CreateRecruitingConversationDto } from './dto/create-recruiting-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateGroupConversationDto } from './dto/update-group-conversation.dto';
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

  // W2-T1: Group Chat CRUD
  @Post('group')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createGroupConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.messagingService.createGroupConversation(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.OK)
  async updateGroupConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpdateGroupConversationDto,
  ) {
    return this.messagingService.updateGroupConversation(
      user.id,
      conversationId,
      dto,
    );
  }

  @Post(':id/participants')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async addParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.messagingService.addParticipant(
      user.id,
      conversationId,
      participantId,
    );
  }

  @Delete(':id/participants/:userId')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.OK)
  async removeParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('userId', ParseUUIDPipe) participantId: string,
  ) {
    return this.messagingService.removeParticipant(
      user.id,
      conversationId,
      participantId,
    );
  }

  // W2-T2: Message Edit & Delete
  @Patch(':id/messages/:messageId')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.OK)
  async editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagingService.editMessage(
      user.id,
      conversationId,
      messageId,
      dto,
    );
  }

  @Delete(':id/messages/:messageId')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messagingService.deleteMessage(
      user.id,
      conversationId,
      messageId,
    );
  }

  // W2-T4: Message Search
  @Get('messages/search')
  async searchMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: SearchMessagesDto,
  ) {
    return this.messagingService.searchMessages(user.id, dto);
  }
}
