-- CreateEnum
CREATE TYPE "HashAlgorithm" AS ENUM ('sha256', 'blake3');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "game_download_resource_files" ADD COLUMN     "hash_algorithm" "HashAlgorithm" NOT NULL DEFAULT 'sha256';

-- AlterTable
ALTER TABLE "game_upload_sessions" ADD COLUMN     "hash_algorithm" "HashAlgorithm" NOT NULL DEFAULT 'sha256';

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;
