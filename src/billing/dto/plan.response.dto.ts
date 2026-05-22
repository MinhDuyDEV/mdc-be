import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PlanResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  slug!: string;

  @Expose()
  description!: string | null;

  @Expose()
  features!: Record<string, unknown>;

  @Expose()
  priceMonthly!: number;

  @Expose()
  priceYearly!: number | null;

  @Expose()
  currency!: string;

  @Expose()
  isPublic!: boolean;

  @Expose()
  isActive!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
