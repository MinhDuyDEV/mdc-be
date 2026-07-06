-- Phase 3 — Jobs & Applications contract fixes
-- 1. Add ScreeningQuestion model (typed screening questions on a Job) + ScreeningQuestionType enum
-- 2. Add Job.requireResume (per-job resume requirement, default false)
-- 3. Add SavedSearch.alertEnabled (toggle alert delivery, default true)
-- 4. Add NotificationType.SavedSearchMatch (in-app notification for saved-search alerts)

-- 1a. ScreeningQuestionType enum
DO $$ BEGIN
  CREATE TYPE "ScreeningQuestionType" AS ENUM ('TEXT', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'NUMERIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1b. screening_questions table
CREATE TABLE IF NOT EXISTS "screening_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "job_id" UUID NOT NULL,
  "question" TEXT NOT NULL,
  "type" "ScreeningQuestionType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "screening_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "screening_questions_job_id_idx" ON "screening_questions"("job_id");

ALTER TABLE "screening_questions"
  ADD CONSTRAINT IF NOT EXISTS "screening_questions_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Job.requireResume
DO $$ BEGIN
  ALTER TABLE "jobs" ADD COLUMN "require_resume" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 3. SavedSearch.alertEnabled
DO $$ BEGIN
  ALTER TABLE "saved_searches" ADD COLUMN "alert_enabled" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 4. NotificationType.SavedSearchMatch
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SavedSearchMatch';