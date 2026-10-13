-- modify "catalog_source_links" table
ALTER TABLE "catalog_source_links" ADD COLUMN "excluded_at" timestamp(3) NULL;
