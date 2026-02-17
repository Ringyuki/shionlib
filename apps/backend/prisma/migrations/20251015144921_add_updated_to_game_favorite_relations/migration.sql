/*
  Warnings:

  - Added the required column `updated` to the `game_favorite_relations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "game_favorite_relations" ADD COLUMN     "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add updated as NULLable first to avoid failing on existing rows
ALTER TABLE "game_favorite_relations" ADD COLUMN     "updated" TIMESTAMP(3);

-- Backfill existing rows
UPDATE "game_favorite_relations" SET "updated" = NOW() WHERE "updated" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "game_favorite_relations" ALTER COLUMN "updated" SET NOT NULL;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;
