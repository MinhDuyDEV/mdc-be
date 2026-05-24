import { ModerationActionType, ReportEntityType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateModerationActionDto {
  @IsUUID()
  reportId!: string;

  @IsEnum(ModerationActionType)
  actionType!: ModerationActionType;

  @IsEnum(ReportEntityType)
  targetEntity!: ReportEntityType;

  @IsUUID()
  targetId!: string;

  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationHours?: number;
}
