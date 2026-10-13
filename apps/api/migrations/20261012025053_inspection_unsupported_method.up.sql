-- modify "file_inspections" table
ALTER TABLE "file_inspections" ADD COLUMN "unsupported_method" boolean NOT NULL DEFAULT false;
