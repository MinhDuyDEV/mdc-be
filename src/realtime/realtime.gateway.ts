import { UseFilters } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { NotificationEventDto } from './dto/notification-event.dto';
import { WsExceptionFilter } from './filters/ws-exception.filter';
import type { RealtimeService } from './realtime.service';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      id: string;
      email: string;
    };
  };
}

@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
@UseFilters(WsExceptionFilter)
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit(server: Server) {
    void server;
    // Gateway initialized
  }

  async handleConnection(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    if (!userId) {
      client.disconnect(true);
      return;
    }

    // Join user-specific room for targeted delivery
    client.join(`user:${userId}`);

    // Set presence
    await this.realtimeService.setUserOnline(userId);
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    if (userId) {
      await this.realtimeService.setUserOffline(userId);
    }
  }

  // Called by NotificationProcessor to push notifications
  pushNotification(userId: string, notification: NotificationEventDto) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
