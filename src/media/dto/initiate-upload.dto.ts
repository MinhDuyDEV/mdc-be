import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class InitiateUploadDto {
  @IsIn(['avatar', 'resume', 'attachment'])
  purpose!: string;

  @IsString()
  filename!: string;

  @IsString()
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
