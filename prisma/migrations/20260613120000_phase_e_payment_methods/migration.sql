-- PaymentMethod table
CREATE TABLE "payment_methods" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "provider" VARCHAR(20) NOT NULL DEFAULT 'stripe',
  "provider_method_id" VARCHAR(255) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "last4" VARCHAR(4),
  "brand" VARCHAR(50),
  "exp_month" INTEGER,
  "exp_year" INTEGER,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "payment_methods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "payment_methods_provider_method_id_unique" UNIQUE ("provider_method_id")
);
CREATE INDEX "payment_methods_company_id_is_default_idx" ON "payment_methods" ("company_id", "is_default");
CREATE INDEX "payment_methods_company_id_status_idx" ON "payment_methods" ("company_id", "status");

-- Add columns to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "provider_payment_method_id" VARCHAR(255);
ALTER TABLE "subscriptions" ADD COLUMN "scheduled_plan_id" UUID;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_scheduled_plan_id_fkey" FOREIGN KEY ("scheduled_plan_id") REFERENCES "billing_plans"("id") ON DELETE SET NULL;

-- WebhookEvent table (idempotency layer 2 for stripe)
CREATE TABLE "webhook_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" VARCHAR(20) NOT NULL,
  "stripe_event_id" VARCHAR(255) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "processed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "webhook_events_stripe_event_id_unique" UNIQUE ("stripe_event_id")
);
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events" ("event_type");
