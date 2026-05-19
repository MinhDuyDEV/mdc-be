import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class EducationDto {
  @IsString()
  @MaxLength(200)
  school: string;

  @IsString()
  @MaxLength(200)
  degree: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldOfStudy?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @IsOptional()
  @IsString()
  activities?: string;
}
