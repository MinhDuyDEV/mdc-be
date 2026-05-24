import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum AnalyticsEventType {
  PROFILE_VIEW = 'profile_view',
  COMPANY_VIEW = 'company_view',
  POST_IMPRESSION = 'post_impression',
}

export class RecordEventDto {
  @IsEnum(AnalyticsEventType)
  eventType!: AnalyticsEventType;

  @IsUUID()
  targetId!: string;

  @IsOptional()
  @IsString()
  source?: string;
}
