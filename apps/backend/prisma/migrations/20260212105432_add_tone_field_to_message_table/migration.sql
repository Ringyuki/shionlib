-- CreateEnum
CREATE TYPE "MessageTone" AS ENUM ('PRIMARY', 'SECONDARY', 'SUCCESS', 'WARNING', 'INFO', 'DESTRUCTIVE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "tone" "MessageTone" NOT NULL DEFAULT 'INFO';
