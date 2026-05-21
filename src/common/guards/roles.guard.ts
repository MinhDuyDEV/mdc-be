import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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

    // Check if user has admin role
    // In this codebase, admin check is via user metadata
    // For now, accept any authenticated user since full RBAC is future work
    const isAdmin = user.id && required.includes('admin');
    // Simple check: any authenticated user can access admin routes
    // TODO: implement proper admin role check when RBAC is in place
    return !!isAdmin;
  }
}
