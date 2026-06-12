-- Phase D: Discovery & Engagement
-- Adds three new tables for email tracking/consent and experiment analytics.
--   - email_tracking_events: open/click events (pixel + redirect)
--   - email_consents: per-user consent + unsubscribe state (HMAC token target)
--   - experiment_impressions: append-only A/B test analytics

-- CreateEnum
CREATE TYPE "EmailTrackingType" AS ENUM ('OPENED', 'CLICKED');

-- CreateTable
CREATE TABLE "email_tracking_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email_id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" "EmailTrackingType" NOT NULL,
    "clicked_url" VARCHAR(2048),
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "tracking_consent" BOOLEAN NOT NULL DEFAULT false,
    "consent_version" VARCHAR(10) NOT NULL DEFAULT '1.0',
    "consented_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "unsubscribed_at" TIMESTAMPTZ(6),
    "unsubscribe_reason" VARCHAR(255),

    CONSTRAINT "email_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_impressions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "experiment_id" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "variant" VARCHAR(50) NOT NULL,
    "impressed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "experiment_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_tracking_events_email_id_idx" ON "email_tracking_events"("email_id");

-- CreateIndex
CREATE INDEX "email_tracking_events_user_id_idx" ON "email_tracking_events"("user_id");

-- CreateIndex
CREATE INDEX "email_tracking_events_event_type_idx" ON "email_tracking_events"("event_type");

-- CreateIndex
CREATE INDEX "email_tracking_events_created_at_idx" ON "email_tracking_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_consents_user_id_key" ON "email_consents"("user_id");

-- CreateIndex
CREATE INDEX "experiment_impressions_experiment_id_user_id_idx" ON "experiment_impressions"("experiment_id", "user_id");

-- CreateIndex
CREATE INDEX "experiment_impressions_experiment_id_idx" ON "experiment_impressions"("experiment_id");

-- CreateIndex
CREATE INDEX "experiment_impressions_user_id_idx" ON "experiment_impressions"("user_id");

-- AddForeignKey
ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "email_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_consents" ADD CONSTRAINT "email_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_impressions" ADD CONSTRAINT "experiment_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
