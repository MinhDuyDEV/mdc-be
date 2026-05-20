import { ApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  newStatus!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
