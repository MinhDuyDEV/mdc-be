import { CompanyRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(CompanyRole)
  role!: CompanyRole;
}
