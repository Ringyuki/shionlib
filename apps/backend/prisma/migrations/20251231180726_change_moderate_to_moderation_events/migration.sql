/*
  Warnings:

  - You are about to drop the `Moderate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Moderate" DROP CONSTRAINT "Moderate_comment_id_fkey";

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- DropTable
DROP TABLE "Moderate";

-- CreateTable
CREATE TABLE "moderation_events" (
    "id" SERIAL NOT NULL,
    "audit_by" INTEGER NOT NULL DEFAULT 1,
    "model" TEXT NOT NULL DEFAULT 'omni-moderation-latest',
    "decision" "ModerationDecision" NOT NULL DEFAULT 'REVIEW',
    "top_category" "ModerateCategoryKey" NOT NULL,
    "categories_json" JSONB NOT NULL,
    "max_score" DECIMAL(6,5),
    "scores_json" JSONB,
    "reason" VARCHAR(2550),
    "evidence" VARCHAR(1000),
    "comment_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_events_comment_id_created_at_idx" ON "moderation_events"("comment_id", "created_at");

-- AddForeignKey
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
