import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/current-user.interface';
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

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId: user.id },
      select: { role: true },
    });

    if (!adminUser) {
      throw new ForbiddenException('Admin access required');
    }

    const userLevel = ROLE_HIERARCHY[adminUser.role];
    const requiredLevel = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY[ROLE_NAME_TO_ADMIN_ROLE[r]]),
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
