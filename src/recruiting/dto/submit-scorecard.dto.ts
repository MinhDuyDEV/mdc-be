import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum Recommendation {
  STRONG_HIRE = 'STRONG_HIRE',
  HIRE = 'HIRE',
  NEUTRAL = 'NEUTRAL',
  NO_HIRE = 'NO_HIRE',
  STRONG_NO_HIRE = 'STRONG_NO_HIRE',
}

export class ScorecardSectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitScorecardDto {
  @IsUUID()
  @IsNotEmpty()
  interviewId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsEnum(Recommendation)
  recommendation!: Recommendation;

  @IsString()
  @IsNotEmpty()
  notes!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardSectionDto)
  sections!: ScorecardSectionDto[];
}
