-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ApplicationSubmitted', 'ApplicationStatusChanged', 'ApplicationNoteAdded', 'ApplicationWithdrawn', 'JobPublished', 'JobUpdated', 'JobClosed', 'CandidateSaved', 'CandidateAddedToTalentPool', 'RecruiterSeatAllocated', 'System');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "title" VARCHAR(255),
    "body" TEXT,
    "action_url" VARCHAR(2048),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Efficient unread-notification reads + unread-count queries.
-- Partial index excludes the (large) read tail so the index stays small.
CREATE INDEX "notifications_unread_idx"
  ON "notifications" ("user_id", "created_at" DESC)
  WHERE "read_at" IS NULL;
