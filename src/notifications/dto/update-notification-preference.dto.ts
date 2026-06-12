import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsBoolean()
  newMessage?: boolean;

  @IsOptional()
  @IsBoolean()
  connectionRequest?: boolean;

  @IsOptional()
  @IsBoolean()
  connectionAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  applicationStatusChange?: boolean;

  @IsOptional()
  @IsBoolean()
  jobRecommendation?: boolean;

  @IsOptional()
  @IsBoolean()
  postInteraction?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}
