import { PostVisibility } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePostDto {
  @IsString()
  content: string;

  @IsEnum(PostVisibility)
  @IsOptional()
  visibility?: PostVisibility;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mediaAssetIds?: string[];
}
