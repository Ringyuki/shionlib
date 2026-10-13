-- reverse: modify "game_download_resources" table
ALTER TABLE "game_download_resources" DROP COLUMN "check_retry_at";
-- reverse: create index "game_download_resource_files_resource_file_name_key" to table: "game_download_resource_files"
DROP INDEX "game_download_resource_files_resource_file_name_key";
