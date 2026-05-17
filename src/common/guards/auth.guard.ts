import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

/**
 * Placeholder authentication guard.
 *
 * In Phase 0A this guard allows all requests through.
 * Real JWT verification will be added in Phase 0C (Auth module).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canActivate(context: ExecutionContext): boolean {
    // Phase 0A: all requests are allowed.
    return true;
  }
}
