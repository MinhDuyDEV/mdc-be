import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../common/auth/current-user.interface';
import { EntitlementsService } from './entitlements.service';
import { ENTITLEMENT_METADATA_KEY } from './require-entitlement.decorator';

interface RequestWithUser {
  user?: AuthenticatedUser;
  params: Record<string, string | undefined>;
}

@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(
      ENTITLEMENT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const companyId = request.params.companyId ?? request.params.id;

    if (!companyId) {
      throw new ForbiddenException('COMPANY_ID_REQUIRED');
    }

    const hasAccess = await this.entitlementsService.checkLimit(
      companyId,
      featureKey,
    );
    if (!hasAccess) {
      throw new ForbiddenException('ENTITLEMENT_EXCEEDED');
    }

    return true;
  }
}
