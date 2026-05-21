import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
  };
}

export const WsCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    return client.data.user as AuthenticatedUser;
  },
);
