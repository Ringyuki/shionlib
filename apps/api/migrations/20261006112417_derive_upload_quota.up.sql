-- modify "users" table
ALTER TABLE "users" ADD COLUMN "upload_trusted" boolean NOT NULL DEFAULT false;
