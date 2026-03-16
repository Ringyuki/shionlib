/*
  Warnings:

  - You are about to drop the column `tags` on the `games` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" DROP COLUMN "tags",
ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;
