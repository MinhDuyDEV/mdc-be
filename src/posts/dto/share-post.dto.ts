import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SharePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;
}
