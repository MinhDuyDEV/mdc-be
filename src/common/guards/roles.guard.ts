import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AdminPermissionName, AdminRole } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/current-user.interface';
import { PERMISSIONS_METADATA_KEY } from '../decorators/permissions.decorator';
import {
  ROLES_METADATA_KEY,
  type RoleName,
} from '../decorators/roles.decorator';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 3,
  [AdminRole.ADMIN]: 2,
  [AdminRole.MODERATOR]: 1,
};

const ROLE_NAME_TO_ADMIN_ROLE: Record<RoleName, AdminRole> = {
  super_admin: AdminRole.SUPER_ADMIN,
  admin: AdminRole.ADMIN,
  moderator: AdminRole.MODERATOR,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<
      AdminPermissionName[]
    >(PERMISSIONS_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId: user.id },
      select: {
        role: true,
        permissions: { select: { permission: true } },
      },
    });

    if (!adminUser) {
      throw new ForbiddenException('Admin access required');
    }

    // Check role hierarchy first
    if (requiredRoles && requiredRoles.length > 0) {
      const userLevel = ROLE_HIERARCHY[adminUser.role];
      const requiredLevel = Math.min(
        ...requiredRoles.map((r) => ROLE_HIERARCHY[ROLE_NAME_TO_ADMIN_ROLE[r]]),
      );

      if (userLevel < requiredLevel) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // SUPER_ADMIN bypasses permission checks
    if (adminUser.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    // Check specific permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = new Set(
        adminUser.permissions.map((p) => p.permission),
      );

      const hasPermission = requiredPermissions.some((p) =>
        userPermissions.has(p),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have the required admin permission',
        );
      }
    }

    return true;
  }
}
