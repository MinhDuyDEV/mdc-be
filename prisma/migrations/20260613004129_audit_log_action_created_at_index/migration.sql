-- Composite index supporting audit log queries filtered by action
-- with a createdAt sort, used by the admin audit log viewer and the
-- planned DSR compliance dashboards.
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx"
  ON "audit_logs" ("action", "created_at" DESC);
