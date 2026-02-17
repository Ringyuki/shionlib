-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "edit_record_id" INTEGER;

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_edit_record_id_fkey" FOREIGN KEY ("edit_record_id") REFERENCES "edit_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
