-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- AlterTable: add soft-delete column to companies
ALTER TABLE "companies" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

-- DropIndex: replace plain unique constraint on slug with partial unique index (active rows only)
DROP INDEX IF EXISTS "companies_slug_key";

-- CreateIndex: partial unique index on slug (excludes soft-deleted rows)
CREATE UNIQUE INDEX "companies_slug_active_key" ON "companies" ("slug") WHERE "deleted_at" IS NULL;

-- CreateIndex: index on deleted_at for soft-delete filtering
CREATE INDEX "companies_deleted_at_idx" ON "companies" ("deleted_at");

-- AlterTable: convert company_members.role from VARCHAR(50) to CompanyRole enum.
-- Existing rows are seeded with lowercase 'admin' / 'owner' from prior code; uppercase them first.
UPDATE "company_members" SET "role" = UPPER("role") WHERE "role" IS NOT NULL;
UPDATE "company_members" SET "role" = 'MEMBER' WHERE "role" NOT IN ('OWNER', 'ADMIN', 'MEMBER');

ALTER TABLE "company_members"
  ALTER COLUMN "role" TYPE "CompanyRole" USING "role"::"CompanyRole";
