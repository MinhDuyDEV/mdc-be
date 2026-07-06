import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { AlertFrequency } from './create-saved-search.dto';

export class UpdateSavedSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  query?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(AlertFrequency)
  frequency?: AlertFrequency;

  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;
}
