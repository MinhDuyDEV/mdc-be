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
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import type { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import type { ConnectionsService } from './connections.service';
import type { SendConnectionRequestDto } from './dto/send-connection-request.dto';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  /** POST /api/v1/connections — Send a connection request */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendConnectionRequestDto,
  ) {
    return this.connectionsService.sendRequest(user.id, dto);
  }

  /** GET /api/v1/connections — List accepted connections (cursor paginated) */
  @Get()
  async listConnections(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.connectionsService.listConnections(user.id, query);
  }

  /** GET /api/v1/connections/pending — List pending requests */
  @Get('pending')
  async listPendingRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.connectionsService.listPendingRequests(user.id, query);
  }

  /** PATCH /api/v1/connections/:id/accept — Accept a pending request */
  @Patch(':id/accept')
  async acceptRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) connectionId: string,
  ) {
    return this.connectionsService.acceptRequest(user.id, connectionId);
  }

  /** PATCH /api/v1/connections/:id/decline — Decline a pending request */
  @Patch(':id/decline')
  async declineRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) connectionId: string,
  ) {
    return this.connectionsService.declineRequest(user.id, connectionId);
  }

  /** DELETE /api/v1/connections/:id — Remove a connection */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) connectionId: string,
  ) {
    await this.connectionsService.removeConnection(user.id, connectionId);
  }

  /** POST /api/v1/connections/users/:id/follow — Follow a user */
  @Post('users/:id/follow')
  @HttpCode(HttpStatus.CREATED)
  async follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) followeeId: string,
  ) {
    return this.connectionsService.follow(user.id, followeeId);
  }

  /** DELETE /api/v1/connections/users/:id/follow — Unfollow a user */
  @Delete('users/:id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) followeeId: string,
  ) {
    await this.connectionsService.unfollow(user.id, followeeId);
  }

  /** POST /api/v1/connections/users/:id/block — Block a user */
  @Post('users/:id/block')
  @HttpCode(HttpStatus.CREATED)
  async blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) blockedUserId: string,
  ) {
    return this.connectionsService.blockUser(user.id, blockedUserId);
  }

  /** DELETE /api/v1/connections/users/:id/block — Unblock a user */
  @Delete('users/:id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) blockedUserId: string,
  ) {
    await this.connectionsService.unblockUser(user.id, blockedUserId);
  }
}
