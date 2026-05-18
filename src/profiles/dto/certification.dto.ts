import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CertificationDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(200)
  issuingOrganization: string;

  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  credentialId?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  credentialUrl?: string;
}
