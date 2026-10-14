-- keep the Chinese image as the banner
ALTER TABLE "ads" RENAME COLUMN "image_zh" TO "banner";
ALTER TABLE "ads" ALTER COLUMN "banner" DROP NOT NULL;
-- add the sidebar material, languages and weight
ALTER TABLE "ads" ADD COLUMN "banner_adult" boolean NOT NULL DEFAULT false, ADD COLUMN "side_image" character varying(500) NULL, ADD COLUMN "side_icon" character varying(500) NULL, ADD COLUMN "side_adult" boolean NOT NULL DEFAULT false, ADD COLUMN "languages" text[] NULL DEFAULT ARRAY[]::text[], ADD COLUMN "weight" integer NOT NULL DEFAULT 5;
-- an ad runs in every language it did not exclude
UPDATE "ads" SET "languages" = ARRAY(SELECT language FROM unnest(ARRAY['zh', 'en', 'ja']) AS language WHERE NOT language = ANY(COALESCE("exclude_locales", ARRAY[]::text[])));
-- the old placements map to the new slots; the old navigation entry needs a sidebar image and is left out
UPDATE "ads" SET "placement" = ARRAY(
  SELECT slot FROM unnest(ARRAY['home', 'game', 'resource', 'download']) AS slot
  WHERE (slot = 'home' AND "placement" && ARRAY['home-after-hero', 'home-after-new-works', 'home-after-recent-updates', 'home-after-hot'])
     OR (slot = 'game' AND "placement" && ARRAY['game-detail-after-header', 'game-detail-bottom', 'game-patch-bottom-1', 'game-patch-bottom-2'])
     OR (slot IN ('resource', 'download') AND "placement" && ARRAY['game-download-bottom-1', 'game-download-bottom-2'])
);
ALTER TABLE "ads" DROP COLUMN "image_ja", DROP COLUMN "image_en", DROP COLUMN "aspect", DROP COLUMN "exclude_locales", DROP COLUMN "sort";
-- create "ad_daily_stats" table
CREATE TABLE "ad_daily_stats" ("id" serial NOT NULL, "slot" character varying(16) NOT NULL, "day" date NOT NULL, "views" integer NOT NULL DEFAULT 0, "clicks" integer NOT NULL DEFAULT 0, "ad_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ad_daily_stats_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "ad_daily_stats_ad_id_slot_day_key" to table: "ad_daily_stats"
CREATE UNIQUE INDEX "ad_daily_stats_ad_id_slot_day_key" ON "ad_daily_stats" ("ad_id", "slot", "day");
-- create index "ad_daily_stats_day_idx" to table: "ad_daily_stats"
CREATE INDEX "ad_daily_stats_day_idx" ON "ad_daily_stats" ("day");
