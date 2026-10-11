-- modify "users" table
ALTER TABLE "users" ADD COLUMN "background" text NULL, ADD COLUMN "show_profile_backgrounds" boolean NOT NULL DEFAULT true;
