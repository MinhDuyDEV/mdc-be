import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ChangePlanDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;
}
