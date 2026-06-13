-- Phase E — GDPR soft-delete extend
-- Add deletedAt columns to 12 child tables for cascade anonymization

ALTER TABLE "experiences" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "experiences_deleted_at_idx" ON "experiences" ("deleted_at");

ALTER TABLE "educations" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "educations_deleted_at_idx" ON "educations" ("deleted_at");

ALTER TABLE "certifications" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "certifications_deleted_at_idx" ON "certifications" ("deleted_at");

ALTER TABLE "applications" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "applications_deleted_at_idx" ON "applications" ("deleted_at");

ALTER TABLE "application_answers" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "application_answers_deleted_at_idx" ON "application_answers" ("deleted_at");

ALTER TABLE "application_attachments" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "application_attachments_deleted_at_idx" ON "application_attachments" ("deleted_at");

ALTER TABLE "connections" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "connections_deleted_at_idx" ON "connections" ("deleted_at");

ALTER TABLE "follows" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "follows_deleted_at_idx" ON "follows" ("deleted_at");

ALTER TABLE "blocks" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "blocks_deleted_at_idx" ON "blocks" ("deleted_at");

ALTER TABLE "notifications" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "notifications_deleted_at_idx" ON "notifications" ("deleted_at");

ALTER TABLE "reactions" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "reactions_deleted_at_idx" ON "reactions" ("deleted_at");

ALTER TABLE "mentions" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "mentions_deleted_at_idx" ON "mentions" ("deleted_at");
