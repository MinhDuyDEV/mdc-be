import { ReportCategory, ReportEntityType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsEnum(ReportEntityType)
  targetEntity!: ReportEntityType;

  @IsUUID()
  targetId!: string;

  @IsEnum(ReportCategory)
  category!: ReportCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
