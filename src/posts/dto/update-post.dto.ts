import { PostVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(PostVisibility)
  @IsOptional()
  visibility?: PostVisibility;
}
