-- Create Skill master table to centralize skill taxonomy
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "category" "SkillCategory",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- Create unique index on skill name for upsert lookups
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- Populate skills from existing profile_skills.name values
INSERT INTO "skills" ("name", "category")
SELECT DISTINCT ps.name, ps.category
FROM "profile_skills" ps
WHERE ps.name IS NOT NULL
ON CONFLICT ("name") DO NOTHING;

-- Populate any job_skills.skill_id referenced names (if job_skills has UUIDs not matching profile_skills names,
-- insert them as placeholders — these will be refined when job skill creation is updated)
-- Note: Current job_skills.skill_id contains raw UUIDs, not skill taxonomy references.
-- We insert a placeholder row for each unique skill_id that doesn't already map to a known skill name.
INSERT INTO "skills" ("id", "name", "category")
SELECT DISTINCT js.skill_id, 'unknown-' || js.skill_id::text, NULL
FROM "job_skills" js
WHERE NOT EXISTS (SELECT 1 FROM "skills" s WHERE s.id = js.skill_id);

-- Add skill_id column to profile_skills
ALTER TABLE "profile_skills" ADD COLUMN "skill_id" UUID;

-- Backfill profile_skills.skill_id from skills table matching on name
UPDATE "profile_skills" ps
SET "skill_id" = s.id
FROM "skills" s
WHERE ps.name = s.name;

-- If any profile_skills rows still lack skill_id (e.g. null names), generate new skills and link
INSERT INTO "skills" ("name", "category")
SELECT DISTINCT ps.name, ps.category
FROM "profile_skills" ps
WHERE ps.name IS NOT NULL AND ps.skill_id IS NULL
ON CONFLICT ("name") DO UPDATE SET "category" = EXCLUDED.category;

-- Retry the backfill for rows that got new skills inserted above
UPDATE "profile_skills" ps
SET "skill_id" = s.id
FROM "skills" s
WHERE ps.name = s.name AND ps.skill_id IS NULL;

-- Make skill_id NOT NULL after backfill
ALTER TABLE "profile_skills" ALTER COLUMN "skill_id" SET NOT NULL;

-- Drop old unique constraint on (profile_id, name) — replaced by (profile_id, skill_id)
ALTER TABLE "profile_skills" DROP CONSTRAINT IF EXISTS "profile_skills_profile_id_name_key";

-- Add new unique constraint and index
CREATE UNIQUE INDEX "profile_skills_profile_id_skill_id_key" ON "profile_skills"("profile_id", "skill_id");
CREATE INDEX "profile_skills_skill_id_idx" ON "profile_skills"("skill_id");

-- Add FK from profile_skills.skill_id → skills.id
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add FK from job_skills.skill_id → skills.id
-- (job_skills.skill_id column already exists; this adds the FK constraint)
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
