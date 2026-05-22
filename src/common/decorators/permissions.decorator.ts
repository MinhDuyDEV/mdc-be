import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionName } from '@prisma/client';

export const PERMISSIONS_METADATA_KEY = Symbol('PERMISSIONS_METADATA_KEY');

/**
 * Requires one or more specific AdminPermission to access the endpoint.
 * Used in combination with @Roles() — RolesGuard checks both role hierarchy
 * and permission grants.
 *
 * @example
 * ```typescript
 * @Permissions('MANAGE_USERS')
 * @Patch('users/:id/status')
 * ```
 */
export const Permissions = (...permissions: AdminPermissionName[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
