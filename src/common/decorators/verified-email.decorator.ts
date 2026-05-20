import { SetMetadata } from '@nestjs/common';

export const VERIFIED_EMAIL_METADATA_KEY = Symbol(
  'VERIFIED_EMAIL_METADATA_KEY',
);

/**
 * Marks a route handler as requiring a verified email address.
 * The `EmailVerifiedGuard` reads this metadata and throws
 * `403 EMAIL_NOT_VERIFIED` when `User.emailVerifiedAt` is null.
 *
 * @example
 *   @VerifiedEmail()
 *   @Post('companies')
 *   createCompany(...) { ... }
 */
export const VerifiedEmail = () =>
  SetMetadata(VERIFIED_EMAIL_METADATA_KEY, true);
