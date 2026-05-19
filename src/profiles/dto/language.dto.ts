import { LanguageProficiency } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class LanguageDto {
  @IsString()
  @MaxLength(100)
  language: string;

  @IsEnum(LanguageProficiency)
  proficiency: LanguageProficiency;
}
