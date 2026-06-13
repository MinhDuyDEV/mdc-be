-- Phase E — GDPR P0 fixes from review
-- 1. Drop the unused deletion_outbox table and DeletionOperation + DeletionOutboxStatus enums
-- 2. Change deletion_audits.request_id FK from CASCADE to RESTRICT (preserve compliance trail)
-- 3. Add UNIQUE constraint on deletion_audits.entry_hash (DB-level guarantee of chain integrity)
-- 4. Add sequence column to deletion_audits (deterministic chain ordering)
-- 5. Add a partial index on deletion_requests for the SLA-monitor query (positive status list)

-- Drop deletion_outbox (cascade handles its FK; it has no dependents)
DROP TABLE IF EXISTS "deletion_outbox";

-- Drop the enums (no longer referenced)
DROP TYPE IF EXISTS "DeletionOperation";
DROP TYPE IF EXISTS "DeletionOutboxStatus";

-- Add sequence column to deletion_audits (idempotent)
DO $$ BEGIN
  ALTER TABLE "deletion_audits" ADD COLUMN "sequence" INTEGER;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Backfill sequence for existing rows (existing chains are re-derived, not preserved)
UPDATE "deletion_audits" AS a
SET "sequence" = sub.rn - 1
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "request_id" ORDER BY "created_at") AS rn
  FROM "deletion_audits"
) AS sub
WHERE a."id" = sub."id" AND a."sequence" IS NULL;

-- Make sequence NOT NULL now that all rows have a value
ALTER TABLE "deletion_audits" ALTER COLUMN "sequence" SET NOT NULL;

-- Change deletion_audits.request_id FK from CASCADE to RESTRICT
ALTER TABLE "deletion_audits" DROP CONSTRAINT IF EXISTS "deletion_audits_request_id_fkey";
ALTER TABLE "deletion_audits"
  ADD CONSTRAINT "deletion_audits_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "deletion_requests"("id") ON DELETE RESTRICT;

-- Add UNIQUE constraint on entry_hash (deterministic audit chain)
DO $$ BEGIN
  ALTER TABLE "deletion_audits" ADD CONSTRAINT "deletion_audits_entry_hash_unique" UNIQUE ("entry_hash");
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;

-- Add a partial index for the SLA-monitor query (avoids NOT IN btree anti-pattern)
CREATE INDEX IF NOT EXISTS "deletion_requests_active_due_by_idx"
  ON "deletion_requests" ("due_by")
  WHERE "status" IN ('PENDING_ERASURE', 'IN_PROGRESS', 'FAILED');

-- Index on (request_id, sequence) for fast chain reconstruction
CREATE INDEX IF NOT EXISTS "deletion_audits_request_id_sequence_idx"
  ON "deletion_audits" ("request_id", "sequence");

