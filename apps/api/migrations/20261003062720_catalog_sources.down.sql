-- reverse: create index "catalog_sync_cursors_source_key" to table: "catalog_sync_cursors"
DROP INDEX "catalog_sync_cursors_source_key";
-- reverse: create "catalog_sync_cursors" table
DROP TABLE "catalog_sync_cursors";
-- reverse: create index "catalog_source_links_source_synced_at_idx" to table: "catalog_source_links"
DROP INDEX "catalog_source_links_source_synced_at_idx";
-- reverse: create index "catalog_source_links_source_entity_local_id_key" to table: "catalog_source_links"
DROP INDEX "catalog_source_links_source_entity_local_id_key";
-- reverse: create index "catalog_source_links_source_entity_external_id_key" to table: "catalog_source_links"
DROP INDEX "catalog_source_links_source_entity_external_id_key";
-- reverse: create "catalog_source_links" table
DROP TABLE "catalog_source_links";
