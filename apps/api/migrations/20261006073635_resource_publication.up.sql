-- modify "game_download_resources" table
ALTER TABLE "game_download_resources" DROP COLUMN "upload_session_id", ADD COLUMN "published_at" timestamp(3) NULL;
