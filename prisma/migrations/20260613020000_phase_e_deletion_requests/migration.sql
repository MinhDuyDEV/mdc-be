-- Phase E — Deletion requests, audit trail, and outbox tables

-- Create enums
DO $$ BEGIN
  CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING_ERASURE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeletionOperation" AS ENUM ('SEARCH_INDEX_DELETE', 'ANALYTICS_ANONYMIZE', 'MEDIA_S3_CLEANUP', 'SESSION_REVOKE', 'REALTIME_DISCONNECT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeletionOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTERED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create deletion_requests table
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" TEXT,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING_ERASURE',
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "due_by" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deletion_requests_user_id_status_idx" ON "deletion_requests" ("user_id", "status");
CREATE INDEX "deletion_requests_status_due_by_idx" ON "deletion_requests" ("status", "due_by");
CREATE INDEX "deletion_requests_scheduled_for_idx" ON "deletion_requests" ("scheduled_for");

ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE;

-- Create deletion_audits table
CREATE TABLE "deletion_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "previous_hash" VARCHAR(64),
    "entry_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deletion_audits_request_id_created_at_idx" ON "deletion_audits" ("request_id", "created_at");
CREATE INDEX "deletion_audits_user_id_idx" ON "deletion_audits" ("user_id");

ALTER TABLE "deletion_audits" ADD CONSTRAINT "deletion_audits_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "deletion_requests"("id") ON DELETE CASCADE;

-- Create deletion_outbox table
CREATE TABLE "deletion_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "operation" "DeletionOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeletionOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deletion_outbox_status_available_at_idx" ON "deletion_outbox" ("status", "available_at");
CREATE INDEX "deletion_outbox_request_id_idx" ON "deletion_outbox" ("request_id");

ALTER TABLE "deletion_outbox" ADD CONSTRAINT "deletion_outbox_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "deletion_requests"("id") ON DELETE CASCADE;
