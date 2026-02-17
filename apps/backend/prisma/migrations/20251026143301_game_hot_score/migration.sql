-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "hot_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "games_hot_score_idx" ON "games"("hot_score");
