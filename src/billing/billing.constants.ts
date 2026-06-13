/**
 * Maps billing plan feature keys to CompanyEntitlement entitlement types.
 *
 * Consumers (BillingService, SubscriptionProcessor) must import from
 * here so the mapping never drifts between paid and free subscription paths.
 */
export const FEATURE_KEY_TO_ENTITLEMENT: Record<string, string> = {
  max_jobs: 'job_posts',
  max_members: 'recruiter_seats',
  max_recruiter_seats: 'recruiter_seats',
};

export const PRORATION_BEHAVIOR = {
  UPGRADE: 'always_invoice' as const,
  DOWNGRADE: 'none' as const,
};

export const BILLING_PROVIDER = {
  STRIPE: 'stripe',
  MOCK: 'mock',
} as const;

export const SUBSCRIPTION_STATUS = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAUSED: 'paused',
} as const;
