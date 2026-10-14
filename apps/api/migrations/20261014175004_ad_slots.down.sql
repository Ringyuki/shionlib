DROP TABLE "ad_daily_stats";
ALTER TABLE "ads" ADD COLUMN "sort" integer NOT NULL DEFAULT 0, ADD COLUMN "exclude_locales" text[] NULL DEFAULT ARRAY[]::text[], ADD COLUMN "aspect" character varying(20) NOT NULL DEFAULT '6 / 1', ADD COLUMN "image_en" character varying(500) NULL, ADD COLUMN "image_ja" character varying(500) NULL;
ALTER TABLE "ads" ALTER COLUMN "aspect" DROP DEFAULT;
UPDATE "ads" SET "exclude_locales" = ARRAY(SELECT language FROM unnest(ARRAY['zh', 'en', 'ja']) AS language WHERE NOT language = ANY(COALESCE("languages", ARRAY[]::text[])));
UPDATE "ads" SET "placement" = ARRAY(
  SELECT DISTINCT CASE slot WHEN 'home' THEN 'home-after-hero' WHEN 'game' THEN 'game-detail-after-header' WHEN 'sidebar' THEN 'nav-ai-girlfriend' ELSE 'game-download-bottom-1' END
  FROM unnest("placement") AS slot
);
UPDATE "ads" SET "banner" = '' WHERE "banner" IS NULL;
ALTER TABLE "ads" ALTER COLUMN "banner" SET NOT NULL;
ALTER TABLE "ads" RENAME COLUMN "banner" TO "image_zh";
ALTER TABLE "ads" DROP COLUMN "weight", DROP COLUMN "languages", DROP COLUMN "side_adult", DROP COLUMN "side_icon", DROP COLUMN "side_image", DROP COLUMN "banner_adult";
