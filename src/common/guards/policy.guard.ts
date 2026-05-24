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
  canActivate(context: ExecutionContext): boolean {
    void context;
    // Phase 0A: always permitted.
    return true;
  }
}
