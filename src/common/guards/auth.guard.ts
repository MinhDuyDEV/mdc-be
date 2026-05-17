import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE } from '../auth/public.decorator';

/**
 * Placeholder authentication guard.
 *
 * In Phase 0A this guard allows all requests through. The public-route
 * metadata check is wired so that `@Public()` continues to be recognised.
 * Real JWT verification will be added in Phase 0C (Auth module).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    // Phase 0A: all requests are allowed; @Public() routes are just honoured.
    if (isPublic) {
      return true;
    }

    return true;
  }
}
