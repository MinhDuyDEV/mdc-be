-- Migration: Phase B — Partial unique index for profile soft-delete
--
-- Adds a partial unique index on `profiles(user_id) WHERE deleted_at IS NULL`
-- so that:
--   1. Active-profile lookups via `findFirst({ where: { userId, deletedAt: null } })`
--      use the unique index (O(log n) instead of sequential scan).
--   2. Re-creating an active profile after a soft-delete is possible without
--      violating the global `userId` unique constraint.
--
-- This mirrors the project's established pattern for soft-deletable tables
-- (e.g. saved_candidates_active_unique, talent_pool_candidates_active_unique).

-- Drop the existing non-unique index on deleted_at (replaced by the partial unique index below).
DROP INDEX IF EXISTS "profiles_deleted_at_idx";

-- Partial unique index: one active profile per user.
CREATE UNIQUE INDEX "profiles_user_id_active_unique"
  ON "profiles" ("user_id")
  WHERE "deleted_at" IS NULL;
