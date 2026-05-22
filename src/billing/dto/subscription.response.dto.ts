import { Exclude, Expose, Type } from 'class-transformer';
import { PlanResponseDto } from './plan.response.dto';

@Exclude()
export class SubscriptionResponseDto {
  @Expose()
  id!: string;

  @Expose()
  companyId!: string;

  @Expose()
  planId!: string;

  @Expose()
  status!: string;

  @Expose()
  currentPeriodStart!: Date;

  @Expose()
  currentPeriodEnd!: Date;

  @Expose()
  cancelAtPeriodEnd!: boolean;

  @Expose()
  canceledAt!: Date | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  @Type(() => PlanResponseDto)
  plan?: PlanResponseDto;
}
