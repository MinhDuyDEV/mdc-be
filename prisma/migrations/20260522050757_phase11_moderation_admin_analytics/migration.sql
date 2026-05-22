-- CreateEnum
CREATE TYPE "ReportEntityType" AS ENUM ('POST', 'COMMENT', 'MESSAGE', 'PROFILE', 'COMPANY', 'JOB');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'VIOLENCE', 'IMPERSONATION', 'COPYRIGHT', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED_ACTIONED', 'RESOLVED_DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('WARN', 'REMOVE_CONTENT', 'SUSPEND_USER', 'BAN_USER', 'DISMISS');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "AdminPermissionName" AS ENUM ('MANAGE_USERS', 'MANAGE_COMPANIES', 'MANAGE_JOBS', 'MODERATE_CONTENT', 'VIEW_ANALYTICS', 'MANAGE_ADMINS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostStatus" ADD VALUE 'FLAGGED';
ALTER TYPE "PostStatus" ADD VALUE 'HIDDEN';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDED';

-- DropIndex
DROP INDEX "profile_skills_profile_id_name_key";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "content_status" VARCHAR(50);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "content_status" VARCHAR(50);

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "content_status" "PostStatus";

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "target_entity" "ReportEntityType" NOT NULL,
    "target_id" UUID NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" SMALLINT NOT NULL DEFAULT 1,
    "assigned_to_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "moderator_id" UUID NOT NULL,
    "action_type" "ModerationActionType" NOT NULL,
    "target_entity" "ReportEntityType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "duration_hours" INTEGER,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "AdminRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" UUID NOT NULL,
    "permission" "AdminPermissionName" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "user_id" UUID,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_impressions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID,
    "ip_hash" VARCHAR(64),
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slotted_counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "slot" SMALLINT NOT NULL,
    "count" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "slotted_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_aggregates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "metric_type" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "count" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_target_entity_target_id_created_at_idx" ON "reports"("target_entity", "target_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_status_priority_created_at_idx" ON "reports"("status", "priority" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_assigned_to_id_idx" ON "reports"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_target_entity_target_id_key" ON "reports"("reporter_id", "target_entity", "target_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_entity_target_id_idx" ON "moderation_actions"("target_entity", "target_id");

-- CreateIndex
CREATE INDEX "moderation_actions_moderator_id_idx" ON "moderation_actions"("moderator_id");

-- CreateIndex
CREATE INDEX "moderation_actions_created_at_idx" ON "moderation_actions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_user_id_key" ON "admin_users"("user_id");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_admin_user_id_permission_key" ON "admin_permissions"("admin_user_id", "permission");

-- CreateIndex
CREATE INDEX "profile_views_profile_id_created_at_idx" ON "profile_views"("profile_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "profile_views_user_id_idx" ON "profile_views"("user_id");

-- CreateIndex
CREATE INDEX "company_views_company_id_created_at_idx" ON "company_views"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "company_views_user_id_idx" ON "company_views"("user_id");

-- CreateIndex
CREATE INDEX "post_impressions_post_id_created_at_idx" ON "post_impressions"("post_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "post_impressions_user_id_idx" ON "post_impressions"("user_id");

-- CreateIndex
CREATE INDEX "slotted_counters_entity_type_entity_id_idx" ON "slotted_counters"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "slotted_counters_entity_type_entity_id_slot_key" ON "slotted_counters"("entity_type", "entity_id", "slot");

-- CreateIndex
CREATE INDEX "analytics_daily_aggregates_date_metric_type_idx" ON "analytics_daily_aggregates"("date", "metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_aggregates_date_metric_type_entity_type_ent_key" ON "analytics_daily_aggregates"("date", "metric_type", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_views" ADD CONSTRAINT "company_views_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_views" ADD CONSTRAINT "company_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_impressions" ADD CONSTRAINT "post_impressions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_impressions" ADD CONSTRAINT "post_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
