-- DropIndex: replace unconditional unique on reports with simple index + partial unique on active reports
DROP INDEX IF EXISTS "reports_reporter_id_target_entity_target_id_key";

-- CreateIndex: simple index for lookups
CREATE INDEX IF NOT EXISTS "reports_reporter_id_target_entity_target_id_idx"
  ON "reports"("reporter_id", "target_entity", "target_id");

-- CreateIndex: partial unique on active reports only (prevents duplicate active reports, allows re-report after resolution)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_report"
  ON "reports" ("reporter_id", "target_entity", "target_id")
  WHERE "status" IN ('PENDING', 'UNDER_REVIEW');

-- CreateIndex: unique constraint on company_verifications (one verification record per company)
CREATE UNIQUE INDEX IF NOT EXISTS "company_verifications_company_id_key"
  ON "company_verifications"("company_id");
