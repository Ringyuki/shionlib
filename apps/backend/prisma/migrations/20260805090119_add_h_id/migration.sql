/*
  Warnings:

  - A unique constraint covering the columns `[h_id]` on the table `games` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "h_id" INTEGER,
ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE UNIQUE INDEX "games_h_id_key" ON "games"("h_id");
