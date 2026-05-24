import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class VerifyCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
