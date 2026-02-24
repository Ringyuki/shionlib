-- CreateEnum
CREATE TYPE "GameDownloadResourceSimulator" AS ENUM ('KRKR', 'ONS', 'ARTEMIS', 'OTHER');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "game_download_resources" ADD COLUMN     "simulator" "GameDownloadResourceSimulator" DEFAULT 'KRKR';

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;
