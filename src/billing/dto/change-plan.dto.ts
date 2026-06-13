import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

const PRORATION_BEHAVIORS = [
  'always_invoice',
  'create_prorations',
  'none',
] as const;

export type ProrationBehavior = (typeof PRORATION_BEHAVIORS)[number];

export class ChangePlanDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;

  /**
   * Proration strategy for the plan change.
   * - `create_prorations` (default): Creates a proration invoice for the
   *   difference. The user is charged or credited immediately.
   * - `always_invoice`: Always generates an invoice regardless of balance.
   * - `none`: No proration — the change takes effect at the next billing
   *   cycle.
   */
  @IsOptional()
  @IsIn(PRORATION_BEHAVIORS)
  prorationBehavior?: ProrationBehavior;
}
