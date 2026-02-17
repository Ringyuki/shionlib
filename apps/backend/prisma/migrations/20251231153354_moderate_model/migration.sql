-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('ALLOW', 'BLOCK', 'REVIEW');

-- CreateEnum
CREATE TYPE "ModerateCategoryKey" AS ENUM ('HARASSMENT', 'HARASSMENT_THREATENING', 'SEXUAL', 'SEXUAL_MINORS', 'HATE', 'HATE_THREATENING', 'ILLICIT', 'ILLICIT_VIOLENT', 'SELF_HARM', 'SELF_HARM_INTENT', 'SELF_HARM_INSTRUCTIONS', 'VIOLENCE', 'VIOLENCE_GRAPHIC');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "Moderate" (
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

    CONSTRAINT "Moderate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Moderate_comment_id_created_at_idx" ON "Moderate"("comment_id", "created_at");

-- AddForeignKey
ALTER TABLE "Moderate" ADD CONSTRAINT "Moderate_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
