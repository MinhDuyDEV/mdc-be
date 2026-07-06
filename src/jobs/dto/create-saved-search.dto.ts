import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export enum AlertFrequency {
  REALTIME = 'REALTIME',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export class CreateSavedSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsObject()
  query!: Record<string, unknown>;

  @IsEnum(AlertFrequency)
  frequency!: AlertFrequency;

  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;
}
