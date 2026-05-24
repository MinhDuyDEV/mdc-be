import { SkillCategory, SkillProficiency } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SkillDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(SkillCategory)
  category?: SkillCategory;

  @IsOptional()
  @IsEnum(SkillProficiency)
  proficiency?: SkillProficiency;
}
