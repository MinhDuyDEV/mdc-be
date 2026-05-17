import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PolicyHandler } from '../policies/policy.types';

export const POLICY_HANDLERS_KEY = Symbol('POLICY_HANDLERS');

/**
 * Placeholder policy/authorization guard.
 *
 * In Phase 0A this guard always returns `true`.  Once domain modules
 * ship real `PolicyHandler` implementations this guard will evaluate
 * them inside `canActivate`.  The metadata key is already wired so
 * that controllers can start annotating routes with `@Policies(...)`.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canActivate(context: ExecutionContext): boolean {
    // Phase 0A: always permitted.
    return true;
  }
}

/**
 * Decorator that attaches one or more `PolicyHandler` classes to a route
 * handler.  Processed by `PolicyGuard` in later phases.
 */
export const Policies = (...handlers: PolicyHandler[]) =>
  Reflector.createDecorator<PolicyHandler[]>({
    key: String(POLICY_HANDLERS_KEY),
    transform: () => handlers,
  });
