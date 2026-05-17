import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

/**
 * Placeholder policy/authorization guard.
 *
 * In Phase 0A this guard always returns `true`.  Once domain modules
 * ship real `PolicyHandler` implementations this guard will evaluate
 * them inside `canActivate`.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canActivate(context: ExecutionContext): boolean {
    // Phase 0A: always permitted.
    return true;
  }
}
