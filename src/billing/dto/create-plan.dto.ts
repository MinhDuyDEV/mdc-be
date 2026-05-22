import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  features!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  priceMonthly!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearly?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
