-- Migration: Phase B — Profile soft delete
--
-- Adds a nullable `deleted_at` column to `profiles` to support
-- moderation REMOVE_CONTENT on PROFILE targets. The moderation service
-- sets `deletedAt = now()` instead of hard-deleting the row, mirroring
-- the existing Company/Message soft-delete pattern.
--
-- No data backfill is required: the column is nullable and existing
-- active profiles are implicitly "not deleted" (deleted_at IS NULL).
-- A partial index on `deleted_at` is added so read-path filters
-- (`WHERE deleted_at IS NULL`) remain cheap as the table grows.

ALTER TABLE "profiles"
  ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

CREATE INDEX "profiles_deleted_at_idx"
  ON "profiles" ("deleted_at");
