-- Phase A: Production hardening schema changes

-- Add unique handle column to users (nullable for existing rows, backfilled by app on registration)
ALTER TABLE "users" ADD COLUMN "handle" TEXT;
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- Add attempts counter to email_deliveries for retry tracking
ALTER TABLE "email_deliveries" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Add external click counter to jobs for ExternalApplyClicked tracking
ALTER TABLE "jobs" ADD COLUMN "external_click_count" INTEGER NOT NULL DEFAULT 0;
