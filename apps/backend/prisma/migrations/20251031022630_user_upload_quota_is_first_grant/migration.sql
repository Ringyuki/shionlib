-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "user_upload_quotas" ADD COLUMN     "is_first_grant" BOOLEAN NOT NULL DEFAULT false;
