-- modify "catalog_source_links" table
ALTER TABLE "catalog_source_links" ADD COLUMN "excluded_by" integer NULL, ADD COLUMN "title" character varying(255) NULL;
-- modify "catalog_sync_cursors" table
ALTER TABLE "catalog_sync_cursors" ADD COLUMN "pulled_at" timestamp(3) NULL, ADD COLUMN "changes" integer NOT NULL DEFAULT 0, ADD COLUMN "failed_at" timestamp(3) NULL, ADD COLUMN "last_error" character varying(500) NULL;
