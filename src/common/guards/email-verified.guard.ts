import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/current-user.interface';
import { VERIFIED_EMAIL_METADATA_KEY } from '../decorators/verified-email.decorator';

// NOTE: companies.service.ts retains inline `emailVerifiedAt` checks because they
// run inside service methods after additional validation, not at route entry.
// Phase 4 controllers should apply this guard to gate the route entirely.

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/**
 * Guards routes decorated with `@VerifiedEmail()`.
 *
 * When the metadata key is present on the handler or controller class, this
 * guard queries Prisma to confirm the authenticated user has a non-null
 * `emailVerifiedAt` timestamp. Routes without the decorator are unaffected.
 *
 * @example
 *   // In a module's providers array:
 *   providers: [{ provide: APP_GUARD, useClass: EmailVerifiedGuard }]
 *
 *   // On a controller method:
 *   @VerifiedEmail()
 *   @Post('companies')
 *   createCompany(...) { ... }
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      VERIFIED_EMAIL_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @VerifiedEmail() metadata — guard is a no-op for this route.
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, emailVerifiedAt: true },
    });

    if (!record || record.emailVerifiedAt === null) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }

    return true;
  }
}
