-- reverse: modify "game_download_resource_files" table
ALTER TABLE "game_download_resource_files" DROP COLUMN "check_stalled_at", DROP COLUMN "check_error", DROP COLUMN "check_failures";
