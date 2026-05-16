import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type AuthenticatedUser } from './current-user.interface';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
