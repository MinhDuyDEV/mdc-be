-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'TOOL', 'SOFT', 'OTHER');

-- CreateEnum
CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('ELEMENTARY', 'LIMITED_WORKING', 'PROFESSIONAL_WORKING', 'FULL_PROFESSIONAL', 'NATIVE_BILINGUAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "display_name" TEXT;

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "TokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "theme" TEXT DEFAULT 'system',
    "language" TEXT DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "headline" VARCHAR(200),
    "about" TEXT,
    "location" VARCHAR(200),
    "website" VARCHAR(500),
    "open_to_work" BOOLEAN NOT NULL DEFAULT false,
    "recruiting_eligible" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "search_vector" tsvector DEFAULT ''::tsvector,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "SkillCategory",
    "proficiency" "SkillProficiency",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "company_url" VARCHAR(500),
    "location" VARCHAR(200),
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "school" VARCHAR(200) NOT NULL,
    "degree" VARCHAR(200) NOT NULL,
    "field_of_study" VARCHAR(200),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "grade" VARCHAR(50),
    "activities" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuing_organization" VARCHAR(200) NOT NULL,
    "issue_date" DATE NOT NULL,
    "expiration_date" DATE,
    "credential_id" VARCHAR(200),
    "credential_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_languages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "language" VARCHAR(100) NOT NULL,
    "proficiency" "LanguageProficiency" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "profile_skill_id" UUID NOT NULL,
    "endorser_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "filename" VARCHAR(500) NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "s3_bucket" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(200) NOT NULL,
    "size_bytes" INTEGER,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "etag" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");

-- CreateIndex
CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_search" ON "profiles" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "profile_skills_profile_id_name_key" ON "profile_skills"("profile_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "profile_languages_profile_id_language_key" ON "profile_languages"("profile_id", "language");

-- CreateIndex
CREATE INDEX "endorsements_profile_id_idx" ON "endorsements"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "endorsements_profile_skill_id_endorser_id_key" ON "endorsements"("profile_skill_id", "endorser_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_s3_key_key" ON "media_assets"("s3_key");

-- CreateIndex
CREATE INDEX "media_assets_owner_id_status_idx" ON "media_assets"("owner_id", "status");

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educations" ADD CONSTRAINT "educations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_profile_skill_id_fkey" FOREIGN KEY ("profile_skill_id") REFERENCES "profile_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_endorser_id_fkey" FOREIGN KEY ("endorser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ====== FULL-TEXT SEARCH TRIGGERS ======

-- Full-text search trigger function
CREATE OR REPLACE FUNCTION profiles_search_update() RETURNS trigger AS $$
DECLARE
  skills_text text;
  experience_text text;
  education_text text;
BEGIN
  SELECT COALESCE(string_agg(ps.name, ' '), '') INTO skills_text
  FROM "profile_skills" ps
  WHERE ps.profile_id = NEW.id;

  SELECT COALESCE(string_agg(
    coalesce(e.title, '') || ' ' || coalesce(e.company, ''), ' '
  ), '') INTO experience_text
  FROM "experiences" e
  WHERE e.profile_id = NEW.id;

  SELECT COALESCE(string_agg(
    coalesce(ed.school, '') || ' ' || coalesce(ed.degree, '') || ' ' || coalesce(ed.field_of_study, ''), ' '
  ), '') INTO education_text
  FROM "educations" ed
  WHERE ed.profile_id = NEW.id;

  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.headline, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.about, '')), 'B') ||
    setweight(to_tsvector('english', skills_text), 'C') ||
    setweight(to_tsvector('english', experience_text), 'C') ||
    setweight(to_tsvector('english', education_text), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on profiles table
CREATE TRIGGER trg_profiles_search
  BEFORE INSERT OR UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION profiles_search_update();

-- Cascade trigger function for child tables
CREATE OR REPLACE FUNCTION trigger_refresh_profile_fts() RETURNS trigger AS $$
BEGIN
  UPDATE "profiles"
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.profile_id, OLD.profile_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Cascade triggers on child tables
CREATE TRIGGER trg_profile_skills_fts_refresh
  AFTER INSERT OR UPDATE OR DELETE ON "profile_skills"
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_profile_fts();

CREATE TRIGGER trg_experiences_fts_refresh
  AFTER INSERT OR UPDATE OR DELETE ON "experiences"
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_profile_fts();

CREATE TRIGGER trg_educations_fts_refresh
  AFTER INSERT OR UPDATE OR DELETE ON "educations"
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_profile_fts();
