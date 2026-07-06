import { ApplyMode, EmploymentType, WorkplaceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ScreeningQuestionInputDto } from './screening-question.dto';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID()
  companyId!: string;

  @IsEnum(ApplyMode)
  applyMode!: ApplyMode;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  applyUrl?: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsEnum(WorkplaceType)
  workplaceType!: WorkplaceType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  skillIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string;

  @IsOptional()
  @IsBoolean()
  requireResume?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScreeningQuestionInputDto)
  screeningQuestions?: ScreeningQuestionInputDto[];
}
