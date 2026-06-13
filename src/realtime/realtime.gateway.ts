import { UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationEventDto } from './dto/notification-event.dto';
import { WsExceptionFilter } from './filters/ws-exception.filter';
import { RealtimeService } from './realtime.service';
import { extractSocketAuthToken } from './socket-auth-token';

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
  server!: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      void this.authenticateSocket(socket as AuthenticatedSocket)
        .then(() => next())
        .catch((error: Error) => next(error));
    });
  }

  private async authenticateSocket(socket: AuthenticatedSocket): Promise<void> {
    const token = extractSocketAuthToken(socket);
    if (!token) {
      throw new Error('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      socket.data.user = { id: payload.sub, email: payload.email };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    if (!userId) {
      client.disconnect(true);
      return;
    }

    // Join user-specific room for targeted delivery
    await client.join(`user:${userId}`);

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

  /**
   * Refresh Redis presence TTL for all connected users every 30 seconds.
   * Without this, keys expire after 60s and users appear offline even with
   * active WebSocket connections.
   */
  @Interval(30_000)
  async refreshPresence() {
    const sockets = await this.server.fetchSockets();
    const seen = new Set<string>();
    for (const socket of sockets) {
      const userId = (socket as unknown as AuthenticatedSocket).data?.user?.id;
      if (userId && !seen.has(userId)) {
        seen.add(userId);
        await this.realtimeService.refreshPresence(userId);
      }
    }
  }

  // Called by NotificationProcessor to push notifications
  pushNotification(userId: string, notification: NotificationEventDto) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  // Called by GdprDeletionProcessor to disconnect all active sockets for a user
  async disconnectUser(userId: string): Promise<void> {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    await this.realtimeService.setUserOffline(userId);
  }
}
