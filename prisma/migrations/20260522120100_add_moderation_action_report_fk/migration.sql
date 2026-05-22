-- AddForeignKey: moderation_actions.report_id -> reports.id
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moderation_actions_report_id_idx"
  ON "moderation_actions"("report_id");
