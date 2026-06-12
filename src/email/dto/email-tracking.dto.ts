import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterUnsubscribeReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export interface UnsubscribeResponseDto {
  success: boolean;
  message: string;
}
