import { SetMetadata } from '@nestjs/common';

export const ROLES_METADATA_KEY = Symbol('ROLES_METADATA_KEY');

export type RoleName = 'admin';

export const Roles = (...roles: RoleName[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
