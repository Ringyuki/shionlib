-- modify "game_download_resources" table
ALTER TABLE "game_download_resources" ADD COLUMN "inspect_retry_at" timestamp(3) NULL, ADD COLUMN "undescribed" boolean NOT NULL DEFAULT false;
