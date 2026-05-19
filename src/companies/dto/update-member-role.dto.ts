import { CompanyRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(CompanyRole)
  role!: CompanyRole;
}
