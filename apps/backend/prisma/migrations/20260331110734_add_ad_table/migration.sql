-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "ads" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "placement" VARCHAR(100) NOT NULL,
    "image_zh" VARCHAR(500) NOT NULL,
    "image_ja" VARCHAR(500),
    "image_en" VARCHAR(500),
    "aspect" VARCHAR(20) NOT NULL,
    "link" VARCHAR(500) NOT NULL,
    "exclude_locales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ads_placement_enabled_idx" ON "ads"("placement", "enabled");

-- CreateIndex
CREATE INDEX "ads_enabled_idx" ON "ads"("enabled");
