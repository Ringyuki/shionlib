-- reverse: create index "game_download_resource_files_inspection_id_idx" to table: "game_download_resource_files"
DROP INDEX "game_download_resource_files_inspection_id_idx";
-- reverse: modify "game_download_resource_files" table
ALTER TABLE "game_download_resource_files" DROP CONSTRAINT "game_download_resource_files_inspection_id_fkey", DROP COLUMN "inspection_id", DROP COLUMN "file_sha256";
-- reverse: create index "file_inspection_entries_inspection_id_parent_id_position_idx" to table: "file_inspection_entries"
DROP INDEX "file_inspection_entries_inspection_id_parent_id_position_idx";
-- reverse: create "file_inspection_entries" table
DROP TABLE "file_inspection_entries";
-- reverse: create index "file_inspections_resource_id_idx" to table: "file_inspections"
DROP INDEX "file_inspections_resource_id_idx";
-- reverse: create "file_inspections" table
DROP TABLE "file_inspections";
