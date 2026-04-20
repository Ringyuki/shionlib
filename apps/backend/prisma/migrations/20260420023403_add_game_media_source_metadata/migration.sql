-- AlterTable
ALTER TABLE "game_covers" ADD COLUMN     "source" TEXT,
ADD COLUMN     "source_key" TEXT,
ADD COLUMN     "source_url" TEXT;

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "game_images" ADD COLUMN     "source" TEXT,
ADD COLUMN     "source_key" TEXT,
ADD COLUMN     "source_url" TEXT;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "game_covers_source_source_key_idx" ON "game_covers"("source", "source_key");

-- CreateIndex
CREATE INDEX "game_images_source_source_key_idx" ON "game_images"("source", "source_key");
