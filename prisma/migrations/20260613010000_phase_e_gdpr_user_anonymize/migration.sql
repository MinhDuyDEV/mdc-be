-- Phase E — GDPR user anonymize fields
-- Add anonymizedAt and anonymizedEmail columns to users table

ALTER TABLE "users" ADD COLUMN "anonymized_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN "anonymized_email" VARCHAR(320);
CREATE INDEX "users_anonymized_at_idx" ON "users" ("anonymized_at");
