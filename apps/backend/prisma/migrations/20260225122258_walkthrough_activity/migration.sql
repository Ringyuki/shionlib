-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "walkthrough_id" INTEGER;

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "activities_walkthrough_id_created_idx" ON "activities"("walkthrough_id", "created");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_walkthrough_id_fkey" FOREIGN KEY ("walkthrough_id") REFERENCES "walkthroughs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
