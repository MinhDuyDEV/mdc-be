import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyRole as CompanyRoleEnum } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/current-user.interface';
import {
  COMPANY_ROLE_METADATA_KEY,
  type CompanyRoleName,
} from '../decorators/company-role.decorator';

/**
 * Hierarchical company-role levels.
 * A higher number satisfies guards that require an equal or lower role.
 */
export const COMPANY_ROLE_LEVEL: Record<CompanyRoleName, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

interface RequestWithUser {
  user?: AuthenticatedUser;
  params: Record<string, string | undefined>;
}

@Injectable()
export class CompanyRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<CompanyRoleName[]>(
      COMPANY_ROLE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @CompanyRole() metadata — guard is a no-op for this route.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const companyId = this.resolveCompanyId(request);
    if (!companyId) {
      throw new ForbiddenException('Company id missing from request');
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
      select: { role: true, status: true },
    });

    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Not a member of this company');
    }

    const userLevel = COMPANY_ROLE_LEVEL[member.role] ?? 0;
    const requiredLevel = Math.min(
      ...required.map(
        (role) => COMPANY_ROLE_LEVEL[role] ?? Number.POSITIVE_INFINITY,
      ),
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `Requires one of: ${required.join(', ')} (have ${member.role})`,
      );
    }

    return true;
  }

  private resolveCompanyId(request: RequestWithUser): string | undefined {
    return request.params.companyId ?? request.params.id;
  }
}

// Re-export the Prisma enum so consumers don't need to import twice.
export { CompanyRoleEnum };
