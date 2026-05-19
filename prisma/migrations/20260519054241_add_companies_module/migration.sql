-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('TECHNOLOGY', 'FINANCE', 'HEALTHCARE', 'EDUCATION', 'RETAIL', 'MANUFACTURING', 'CONSULTING', 'REAL_ESTATE', 'HOSPITALITY', 'TRANSPORTATION', 'ENERGY', 'TELECOMMUNICATIONS', 'MEDIA', 'LEGAL', 'NONPROFIT', 'GOVERNMENT', 'AGRICULTURE', 'CONSTRUCTION', 'AUTOMOTIVE', 'OTHER');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "industry" "Industry",
    "description" TEXT,
    "website" VARCHAR(500),
    "logo_media_asset_id" UUID,
    "cover_media_asset_id" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "employee_count" VARCHAR(50),
    "founded_year" INTEGER,
    "headquarters" VARCHAR(200),
    "search_vector" tsvector DEFAULT ''::tsvector,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_followers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "document_urls" TEXT[],
    "notes" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_entitlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "entitlement_type" VARCHAR(100) NOT NULL,
    "credits_total" INTEGER NOT NULL,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "credits_remaining" INTEGER NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_seats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'available',
    "allocated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiter_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "invited_by" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "member_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_industry_idx" ON "companies"("industry");

-- CreateIndex
CREATE INDEX "companies_verified_idx" ON "companies"("verified");

-- CreateIndex
CREATE INDEX "idx_companies_search" ON "companies" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "company_members_company_id_idx" ON "company_members"("company_id");

-- CreateIndex
CREATE INDEX "company_members_user_id_idx" ON "company_members"("user_id");

-- CreateIndex
CREATE INDEX "company_members_status_idx" ON "company_members"("status");

-- CreateIndex
CREATE UNIQUE INDEX "company_members_company_id_user_id_key" ON "company_members"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "company_followers_company_id_idx" ON "company_followers"("company_id");

-- CreateIndex
CREATE INDEX "company_followers_user_id_idx" ON "company_followers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_followers_company_id_user_id_key" ON "company_followers"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "company_verifications_company_id_idx" ON "company_verifications"("company_id");

-- CreateIndex
CREATE INDEX "company_verifications_status_idx" ON "company_verifications"("status");

-- CreateIndex
CREATE INDEX "company_entitlements_company_id_idx" ON "company_entitlements"("company_id");

-- CreateIndex
CREATE INDEX "company_entitlements_entitlement_type_idx" ON "company_entitlements"("entitlement_type");

-- CreateIndex
CREATE INDEX "company_entitlements_valid_until_idx" ON "company_entitlements"("valid_until");

-- CreateIndex
CREATE INDEX "recruiter_seats_company_id_idx" ON "recruiter_seats"("company_id");

-- CreateIndex
CREATE INDEX "recruiter_seats_user_id_idx" ON "recruiter_seats"("user_id");

-- CreateIndex
CREATE INDEX "recruiter_seats_status_idx" ON "recruiter_seats"("status");

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_token_key" ON "member_invitations"("token");

-- CreateIndex
CREATE INDEX "member_invitations_company_id_idx" ON "member_invitations"("company_id");

-- CreateIndex
CREATE INDEX "member_invitations_email_idx" ON "member_invitations"("email");

-- CreateIndex
CREATE INDEX "member_invitations_token_idx" ON "member_invitations"("token");

-- CreateIndex
CREATE INDEX "member_invitations_status_idx" ON "member_invitations"("status");

-- CreateIndex
CREATE INDEX "member_invitations_expires_at_idx" ON "member_invitations"("expires_at");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_media_asset_id_fkey" FOREIGN KEY ("logo_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_cover_media_asset_id_fkey" FOREIGN KEY ("cover_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_followers" ADD CONSTRAINT "company_followers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_followers" ADD CONSTRAINT "company_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_verifications" ADD CONSTRAINT "company_verifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_verifications" ADD CONSTRAINT "company_verifications_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_verifications" ADD CONSTRAINT "company_verifications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_entitlements" ADD CONSTRAINT "company_entitlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_seats" ADD CONSTRAINT "recruiter_seats_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_seats" ADD CONSTRAINT "recruiter_seats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
