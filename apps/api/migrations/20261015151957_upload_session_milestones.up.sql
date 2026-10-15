-- modify "game_upload_sessions" table
ALTER TABLE "game_upload_sessions" ADD COLUMN "last_chunk_at" timestamp(3) NULL, ADD COLUMN "completed_at" timestamp(3) NULL, ADD COLUMN "submitted_at" timestamp(3) NULL, ADD COLUMN "aborted_at" timestamp(3) NULL, ADD COLUMN "ended_at" timestamp(3) NULL;
-- create index "game_upload_sessions_created_idx" to table: "game_upload_sessions"
CREATE INDEX "game_upload_sessions_created_idx" ON "game_upload_sessions" ("created");
-- create index "upload_failures_session_id_idx" to table: "upload_failures"
CREATE INDEX "upload_failures_session_id_idx" ON "upload_failures" ("session_id");
-- earlier uploads: a finished, cancelled or expired upload was last changed when it finished
UPDATE "game_upload_sessions" SET "completed_at" = "updated" WHERE "status" = 'COMPLETED';
UPDATE "game_upload_sessions" SET "aborted_at" = "updated" WHERE "status" = 'ABORTED';
UPDATE "game_upload_sessions" SET "ended_at" = "updated" WHERE "status" IN ('ABORTED', 'EXPIRED');
-- an upload that a file was made from was submitted when the file, or the replacement of its content, was made
UPDATE "game_upload_sessions" AS s SET "submitted_at" = f."created" FROM "game_download_resource_files" AS f WHERE f."upload_session_id" = s."id";
UPDATE "game_upload_sessions" AS s SET "submitted_at" = h."created" FROM "game_download_resource_file_histories" AS h WHERE h."upload_session_id" = s."id";
