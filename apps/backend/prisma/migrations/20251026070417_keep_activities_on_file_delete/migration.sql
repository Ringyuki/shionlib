-- DropForeignKey
ALTER TABLE "public"."activities" DROP CONSTRAINT "activities_file_id_fkey";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size" BIGINT;

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "game_download_resource_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
