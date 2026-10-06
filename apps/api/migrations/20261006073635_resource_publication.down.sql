-- reverse: modify "game_download_resources" table
ALTER TABLE "game_download_resources" DROP COLUMN "published_at", ADD COLUMN "upload_session_id" integer NULL;
