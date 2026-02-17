-- AlterTable
ALTER TABLE "game_characters" ALTER COLUMN "intro_jp" SET DATA TYPE VARCHAR(20000),
ALTER COLUMN "intro_zh" SET DATA TYPE VARCHAR(20000),
ALTER COLUMN "intro_en" SET DATA TYPE VARCHAR(20000);

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;
