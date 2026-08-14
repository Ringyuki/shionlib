/*
  Warnings:

  - A unique constraint covering the columns `[h_id]` on the table `game_characters` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[h_id]` on the table `game_developers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "game_characters" ADD COLUMN     "h_id" INTEGER;

-- AlterTable
ALTER TABLE "game_developers" ADD COLUMN     "h_id" INTEGER,
ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "hikarinagi_sync_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_event_id" BIGINT NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hikarinagi_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_characters_h_id_key" ON "game_characters"("h_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_developers_h_id_key" ON "game_developers"("h_id");
