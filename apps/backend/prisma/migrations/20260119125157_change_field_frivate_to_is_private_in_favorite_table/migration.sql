/*
  Warnings:

  - You are about to drop the column `private` on the `favorites` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "favorites" DROP COLUMN "private",
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;
