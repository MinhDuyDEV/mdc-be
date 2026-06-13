-- Media scan + thumbnail fields. The plan's T2 schema additions.
ALTER TABLE "media_assets"
  ADD COLUMN "scan_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scan_result" JSONB,
  ADD COLUMN "scanned_at" TIMESTAMPTZ(3),
  ADD COLUMN "thumb_s3_key" VARCHAR(500),
  ADD COLUMN "thumb_generated_at" TIMESTAMPTZ(3);

-- Add 'QUARANTINED' to the MediaStatus enum if not already present.
ALTER TYPE "MediaStatus" ADD VALUE IF NOT EXISTS 'QUARANTINED';

-- Index for finding pending scans and quarantined files quickly.
CREATE INDEX IF NOT EXISTS "media_assets_scan_status_idx"
  ON "media_assets" ("scan_status");
