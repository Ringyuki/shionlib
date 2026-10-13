-- modify "game_download_resource_files" table
ALTER TABLE "game_download_resource_files" ADD COLUMN "original_name" text NULL;
-- modify "game_download_resources" table
ALTER TABLE "game_download_resources" ADD COLUMN "canonical_name" boolean NOT NULL DEFAULT false;
