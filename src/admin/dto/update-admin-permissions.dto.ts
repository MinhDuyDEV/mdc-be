import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { AdminPermissionName } from '@prisma/client';

export class UpdateAdminPermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AdminPermissionName, { each: true })
  permissions!: AdminPermissionName[];
}
