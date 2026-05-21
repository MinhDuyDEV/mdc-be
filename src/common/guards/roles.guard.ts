import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/current-user.interface';
import {
  ROLES_METADATA_KEY,
  type RoleName,
} from '../decorators/roles.decorator';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin check: reject all requests until proper RBAC is implemented.
    // TODO: implement proper admin role check when RBAC is in place
    // (e.g. check user.role === 'admin' or query admin allowlist).
    if (required.includes('admin')) {
      throw new ForbiddenException(
        'Admin access is not yet available. RBAC implementation pending.',
      );
    }

    return true;
  }
}
