-- reverse: modify "catalog_sync_cursors" table
ALTER TABLE "catalog_sync_cursors" DROP COLUMN "last_error", DROP COLUMN "failed_at", DROP COLUMN "changes", DROP COLUMN "pulled_at";
-- reverse: modify "catalog_source_links" table
ALTER TABLE "catalog_source_links" DROP COLUMN "title", DROP COLUMN "excluded_by";
