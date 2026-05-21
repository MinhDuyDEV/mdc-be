import {
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import type { MessagingPolicyService } from '../messaging/messaging-policy.service';
import type { ConversationJoinDto } from './dto/conversation-join.dto';
import type { MessageEventDto } from './dto/message-event.dto';
import type { MessageReadDto } from './dto/message-read.dto';
import type { TypingEventDto } from './dto/typing-event.dto';
import { WsExceptionFilter } from './filters/ws-exception.filter';
import { WsCurrentUser } from './ws-current-user.decorator';
import { WsJwtGuard } from './ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
  };
}

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
@UseFilters(WsExceptionFilter)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) =>
      new WsException({
        status: 'error',
        message: 'Validation failed',
        details: errors.map((e) => ({
          field: e.property,
          constraints: e.constraints,
        })),
      }),
  }),
)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messagingPolicy: MessagingPolicyService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rawToken =
      client.handshake.auth?.token ?? client.handshake.query?.token;
    const token = typeof rawToken === 'string' ? rawToken : undefined;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.user = { id: payload.sub, email: payload.email };
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    void client;
    // Cleanup handled by Socket.io automatically
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('conversation:join')
  async handleConversationJoin(
    @MessageBody() dto: ConversationJoinDto,
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: AuthenticatedUser,
  ) {
    const isParticipant = await this.messagingPolicy.isActiveParticipant(
      user.id,
      dto.conversationId,
    );

    if (!isParticipant) {
      throw new WsException('Not authorized to join this conversation');
    }

    client.join(`conversation:${dto.conversationId}`);

    return { ok: true, conversationId: dto.conversationId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:started')
  async handleTypingStarted(
    @MessageBody() dto: TypingEventDto,
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: AuthenticatedUser,
  ) {
    const isParticipant = await this.messagingPolicy.isActiveParticipant(
      user.id,
      dto.conversationId,
    );

    if (!isParticipant) {
      throw new WsException('Not authorized');
    }

    client.to(`conversation:${dto.conversationId}`).emit('typing:started', {
      conversationId: dto.conversationId,
      userId: user.id,
    });

    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:stopped')
  async handleTypingStopped(
    @MessageBody() dto: TypingEventDto,
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: AuthenticatedUser,
  ) {
    const isParticipant = await this.messagingPolicy.isActiveParticipant(
      user.id,
      dto.conversationId,
    );

    if (!isParticipant) {
      throw new WsException('Not authorized');
    }

    client.to(`conversation:${dto.conversationId}`).emit('typing:stopped', {
      conversationId: dto.conversationId,
      userId: user.id,
    });

    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:read')
  async handleMessageRead(
    @MessageBody() dto: MessageReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: AuthenticatedUser,
  ) {
    const isParticipant = await this.messagingPolicy.isActiveParticipant(
      user.id,
      dto.conversationId,
    );

    if (!isParticipant) {
      throw new WsException('Not authorized');
    }

    client.to(`conversation:${dto.conversationId}`).emit('message:read', {
      messageId: dto.messageId,
      conversationId: dto.conversationId,
      userId: user.id,
      readAt: new Date(),
    });

    return { ok: true };
  }

  // Called by MessagingProcessor to push new messages
  pushMessage(conversationId: string, message: MessageEventDto) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:new', message);
  }
}
