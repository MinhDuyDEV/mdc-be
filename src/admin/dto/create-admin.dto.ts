import { ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';
import { AdminPermissionName } from '@prisma/client';

export class CreateAdminDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AdminPermissionName, { each: true })
  permissions!: AdminPermissionName[];
}
