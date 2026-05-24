import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { extractSocketAuthToken } from './socket-auth-token';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      id: string;
      email: string;
    };
  };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);

      // Attach user to socket session
      client.data.user = {
        id: payload.sub,
        email: payload.email,
      };

      return true;
    } catch {
      throw new WsException('Invalid or expired token');
    }
  }

  private extractToken(client: Socket): string | undefined {
    return extractSocketAuthToken(client);
  }
}
