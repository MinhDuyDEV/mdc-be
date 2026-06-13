import { IsOptional, IsString } from 'class-validator';

export class CreateDeletionRequestDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
