-- ADR-0001: opaque refresh-token family tracking.
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" UUID;
ALTER TABLE "refresh_tokens" ADD COLUMN "parent_token_id" UUID;

-- Existing bcrypt/legacy tokens become one-token families and remain readable
-- until their natural expiry.
UPDATE "refresh_tokens"
SET "family_id" = "id"
WHERE "family_id" IS NULL;

ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;

CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX "refresh_tokens_parent_token_id_idx" ON "refresh_tokens"("parent_token_id");

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "refresh_tokens_parent_token_id_fkey"
FOREIGN KEY ("parent_token_id")
REFERENCES "refresh_tokens"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- ADR-0002: persisted media visibility with conservative backfill.
CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'CONNECTIONS_ONLY', 'PUBLIC');

ALTER TABLE "media_assets"
ADD COLUMN "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE';

UPDATE "media_assets"
SET "visibility" = 'PUBLIC'
WHERE "id" IN (
  SELECT "logo_media_asset_id"
  FROM "companies"
  WHERE "logo_media_asset_id" IS NOT NULL
    AND "deleted_at" IS NULL

  UNION

  SELECT "cover_media_asset_id"
  FROM "companies"
  WHERE "cover_media_asset_id" IS NOT NULL
    AND "deleted_at" IS NULL

  UNION

  SELECT pm."media_asset_id"
  FROM "post_media" pm
  INNER JOIN "posts" p ON p."id" = pm."post_id"
  WHERE p."visibility" = 'PUBLIC'
    AND p."status" = 'PUBLISHED'
    AND p."deleted_at" IS NULL
);

CREATE INDEX "media_assets_visibility_status_idx" ON "media_assets"("visibility", "status");

-- ADR-0005: entity relationship counts use Prisma _count instead.
ALTER TABLE "companies" DROP COLUMN "follower_count";
