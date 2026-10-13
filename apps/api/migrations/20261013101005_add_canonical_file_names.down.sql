-- reverse: modify "game_download_resources" table
ALTER TABLE "game_download_resources" DROP COLUMN "canonical_name";
-- reverse: modify "game_download_resource_files" table
ALTER TABLE "game_download_resource_files" DROP COLUMN "original_name";
