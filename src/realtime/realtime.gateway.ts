import { UseFilters } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
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

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    server.use(async (socket, next) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const rawToken =
        socket.handshake.auth?.token ?? socket.handshake.query?.token;
      const token = typeof rawToken === 'string' ? rawToken : undefined;
      if (!token) {
        next(new Error('Missing authentication token'));
        return;
      }
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub: string;
          email: string;
        }>(token);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        socket.data.user = { id: payload.sub, email: payload.email };
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
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
    if (!userId) return;

    // Only clear presence when no remaining sockets for this user
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    if (sockets.length === 0) {
      await this.realtimeService.setUserOffline(userId);
    }
  }

  // Called by NotificationProcessor to push notifications
  pushNotification(userId: string, notification: NotificationEventDto) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
