-- reverse: create index "game_download_resource_events_resource_id_created_idx" to table: "game_download_resource_events"
DROP INDEX "game_download_resource_events_resource_id_created_idx";
-- reverse: create "game_download_resource_events" table
DROP TABLE "game_download_resource_events";
-- reverse: create index "comments_resource_id_pinned_key" to table: "comments"
DROP INDEX "comments_resource_id_pinned_key";
-- reverse: create index "comments_resource_id_created_idx" to table: "comments"
DROP INDEX "comments_resource_id_created_idx";
-- reverse: modify "comments" table
ALTER TABLE "comments" DROP CONSTRAINT "comments_resource_id_fkey", DROP COLUMN "resource_id", DROP COLUMN "pinned_at";
