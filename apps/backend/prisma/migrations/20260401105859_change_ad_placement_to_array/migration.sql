/*
  Warnings:

  - The `placement` column on the `ads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "ads_placement_enabled_idx";

-- AlterTable
ALTER TABLE "ads" DROP COLUMN "placement",
ADD COLUMN     "placement" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "ads_placement_idx" ON "ads" USING GIN ("placement");
