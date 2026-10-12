-- modify "game_download_resource_files" table
ALTER TABLE "game_download_resource_files" ADD COLUMN "check_failures" integer NOT NULL DEFAULT 0, ADD COLUMN "check_error" text NULL, ADD COLUMN "check_stalled_at" timestamp(3) NULL;
