import { ProfileVisibility } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  about?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsBoolean()
  openToWork?: boolean;

  @IsOptional()
  @IsBoolean()
  recruitingEligible?: boolean;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility;
}
