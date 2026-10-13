-- create "catalog_source_links" table
CREATE TABLE "catalog_source_links" ("id" serial NOT NULL, "source" character varying(32) NOT NULL, "entity" character varying(16) NOT NULL, "external_id" character varying(64) NOT NULL, "local_id" integer NOT NULL, "revision" character varying(64) NULL, "synced_at" timestamp(3) NULL, "missing_at" timestamp(3) NULL, "failures" integer NOT NULL DEFAULT 0, "last_error" character varying(500) NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create index "catalog_source_links_source_entity_external_id_key" to table: "catalog_source_links"
CREATE UNIQUE INDEX "catalog_source_links_source_entity_external_id_key" ON "catalog_source_links" ("source", "entity", "external_id");
-- create index "catalog_source_links_source_entity_local_id_key" to table: "catalog_source_links"
CREATE UNIQUE INDEX "catalog_source_links_source_entity_local_id_key" ON "catalog_source_links" ("source", "entity", "local_id");
-- create index "catalog_source_links_source_synced_at_idx" to table: "catalog_source_links"
CREATE INDEX "catalog_source_links_source_synced_at_idx" ON "catalog_source_links" ("source", "synced_at");
-- create "catalog_sync_cursors" table
CREATE TABLE "catalog_sync_cursors" ("id" serial NOT NULL, "source" character varying(32) NOT NULL, "cursor" character varying(255) NOT NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create index "catalog_sync_cursors_source_key" to table: "catalog_sync_cursors"
CREATE UNIQUE INDEX "catalog_sync_cursors_source_key" ON "catalog_sync_cursors" ("source");
