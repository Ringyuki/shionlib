-- create index "game_download_resource_files_resource_file_name_key" to table: "game_download_resource_files"
CREATE UNIQUE INDEX "game_download_resource_files_resource_file_name_key" ON "game_download_resource_files" ("game_download_resource_id", "file_name");
-- modify "game_download_resources" table
ALTER TABLE "game_download_resources" ADD COLUMN "check_retry_at" timestamp(3) NULL;
