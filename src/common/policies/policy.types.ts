import { type AuthenticatedUser } from '../auth/current-user.interface';

export interface PolicyContext<TResource = unknown> {
  user?: AuthenticatedUser;
  resource?: TResource;
}

export interface PolicyHandler<TResource = unknown> {
  canActivate(context: PolicyContext<TResource>): boolean | Promise<boolean>;
}
