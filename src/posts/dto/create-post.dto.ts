import { PostVisibility } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(PostVisibility)
  @IsOptional()
  visibility?: PostVisibility;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mediaAssetIds?: string[];
}
