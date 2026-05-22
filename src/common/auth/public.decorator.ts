import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = Symbol('IS_PUBLIC_ROUTE');
export const IS_OPTIONAL_AUTH = Symbol('IS_OPTIONAL_AUTH');

export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);

/**
 * Marks a route as having optional authentication.
 * AuthGuard will try to authenticate but won't throw 401 if no token is present.
 * Use for endpoints that behave differently for authenticated vs anonymous users.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH, true);
