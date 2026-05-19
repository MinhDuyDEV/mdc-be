import { SetMetadata } from '@nestjs/common';
import type { CompanyRole as CompanyRoleEnum } from '@prisma/client';

export const COMPANY_ROLE_METADATA_KEY = Symbol('COMPANY_ROLE_METADATA_KEY');

export type CompanyRoleName = keyof typeof CompanyRoleEnum;

/**
 * Marks a route handler as requiring company membership with one of the
 * specified roles. The `CompanyRoleGuard` reads this metadata, resolves the
 * `companyId` route param, and checks the caller's membership level using
 * the hierarchy: OWNER > ADMIN > MEMBER.
 *
 * @example
 *   @CompanyRole('OWNER', 'ADMIN')
 *   @Patch(':id')
 *   updateCompany(...) { ... }
 */
export const CompanyRole = (...roles: CompanyRoleName[]) =>
  SetMetadata(COMPANY_ROLE_METADATA_KEY, roles);
