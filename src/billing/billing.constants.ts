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
