-- modify "comments" table
ALTER TABLE "comments" ADD COLUMN "pinned_at" timestamp(3) NULL, ADD COLUMN "resource_id" integer NULL, ADD CONSTRAINT "comments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "game_download_resources" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
-- create index "comments_resource_id_created_idx" to table: "comments"
CREATE INDEX "comments_resource_id_created_idx" ON "comments" ("resource_id", "created");
-- create index "comments_resource_id_pinned_key" to table: "comments"
CREATE UNIQUE INDEX "comments_resource_id_pinned_key" ON "comments" ("resource_id") WHERE (pinned_at IS NOT NULL);
-- create "game_download_resource_events" table
CREATE TABLE "game_download_resource_events" ("id" serial NOT NULL, "kind" character varying(32) NOT NULL, "data" jsonb NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resource_id" integer NOT NULL, "actor_id" integer NULL, PRIMARY KEY ("id"), CONSTRAINT "game_download_resource_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE RESTRICT, CONSTRAINT "game_download_resource_events_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "game_download_resources" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "game_download_resource_events_resource_id_created_idx" to table: "game_download_resource_events"
CREATE INDEX "game_download_resource_events_resource_id_created_idx" ON "game_download_resource_events" ("resource_id", "created");
