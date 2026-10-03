-- create index "moderation_events_walkthrough_id_created_at_idx" to table: "moderation_events"
CREATE INDEX "moderation_events_walkthrough_id_created_at_idx" ON "moderation_events" ("walkthrough_id", "created_at");
