-- CreateTable
CREATE TABLE "candidate_sources" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_candidates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "candidate_user_id" UUID NOT NULL,
    "saved_by_user_id" UUID NOT NULL,
    "source_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "saved_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_pools" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "talent_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_pool_candidates" (
    "id" UUID NOT NULL,
    "talent_pool_id" UUID NOT NULL,
    "candidate_user_id" UUID NOT NULL,
    "added_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "talent_pool_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_notes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "candidate_user_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_sources_code_key" ON "candidate_sources"("code");

-- CreateIndex
CREATE INDEX "saved_candidates_company_id_created_at_deleted_at_idx" ON "saved_candidates"("company_id", "created_at" DESC, "deleted_at");

-- CreateIndex
CREATE INDEX "saved_candidates_candidate_user_id_idx" ON "saved_candidates"("candidate_user_id");

-- CreateIndex
CREATE INDEX "saved_candidates_saved_by_user_id_idx" ON "saved_candidates"("saved_by_user_id");

-- CreateIndex
CREATE INDEX "talent_pools_company_id_created_at_deleted_at_idx" ON "talent_pools"("company_id", "created_at" DESC, "deleted_at");

-- CreateIndex
CREATE INDEX "talent_pools_created_by_user_id_idx" ON "talent_pools"("created_by_user_id");

-- CreateIndex
CREATE INDEX "talent_pool_candidates_talent_pool_id_created_at_deleted_at_idx" ON "talent_pool_candidates"("talent_pool_id", "created_at" DESC, "deleted_at");

-- CreateIndex
CREATE INDEX "talent_pool_candidates_candidate_user_id_idx" ON "talent_pool_candidates"("candidate_user_id");

-- CreateIndex
CREATE INDEX "candidate_notes_company_id_candidate_user_id_created_at_del_idx" ON "candidate_notes"("company_id", "candidate_user_id", "created_at" DESC, "deleted_at");

-- CreateIndex
CREATE INDEX "candidate_notes_author_user_id_idx" ON "candidate_notes"("author_user_id");

-- AddForeignKey
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_candidate_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_saved_by_user_id_fkey" FOREIGN KEY ("saved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "candidate_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pools" ADD CONSTRAINT "talent_pools_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pools" ADD CONSTRAINT "talent_pools_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_talent_pool_id_fkey" FOREIGN KEY ("talent_pool_id") REFERENCES "talent_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_candidate_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidate_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Active SavedCandidate uniqueness: one in-flight saved entry per (company, candidate).
CREATE UNIQUE INDEX "saved_candidates_active_unique"
  ON "saved_candidates" ("company_id", "candidate_user_id")
  WHERE "deleted_at" IS NULL;

-- Active TalentPoolCandidate uniqueness: one in-flight membership per (pool, candidate).
CREATE UNIQUE INDEX "talent_pool_candidates_active_unique"
  ON "talent_pool_candidates" ("talent_pool_id", "candidate_user_id")
  WHERE "deleted_at" IS NULL;

-- Active TalentPool name uniqueness within a company.
CREATE UNIQUE INDEX "talent_pools_name_active_unique"
  ON "talent_pools" ("company_id", "name")
  WHERE "deleted_at" IS NULL;
