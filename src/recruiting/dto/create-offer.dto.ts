import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOfferDto {
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsNumber()
  @Min(0)
  salaryAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
