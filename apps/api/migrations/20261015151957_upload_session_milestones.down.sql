-- reverse: create index "upload_failures_session_id_idx" to table: "upload_failures"
DROP INDEX "upload_failures_session_id_idx";
-- reverse: create index "game_upload_sessions_created_idx" to table: "game_upload_sessions"
DROP INDEX "game_upload_sessions_created_idx";
-- reverse: modify "game_upload_sessions" table
ALTER TABLE "game_upload_sessions" DROP COLUMN "ended_at", DROP COLUMN "aborted_at", DROP COLUMN "submitted_at", DROP COLUMN "completed_at", DROP COLUMN "last_chunk_at";
