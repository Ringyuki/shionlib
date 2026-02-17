-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('COMMENT', 'FILE_UPLOAD_TO_SERVER', 'FILE_UPLOAD_TO_S3', 'FILE_CHECK_OK', 'FILE_CHECK_BROKEN_OR_TRUNCATED', 'FILE_CHECK_BROKEN_OR_UNSUPPORTED', 'FILE_CHECK_ENCRYPTED', 'FILE_CHECK_HARMFUL', 'GAME_EDIT', 'DEVELOPER_EDIT', 'CHARACTER_EDIT');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "type" "ActivityType" NOT NULL,
    "user_id" INTEGER NOT NULL,
    "game_id" INTEGER,
    "developer_id" INTEGER,
    "character_id" INTEGER,
    "file_id" INTEGER,
    "file_status" INTEGER DEFAULT 1,
    "file_check_status" INTEGER DEFAULT 0,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "game_developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "game_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "game_download_resource_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
