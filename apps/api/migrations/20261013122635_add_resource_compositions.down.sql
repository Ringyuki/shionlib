-- reverse: create index "resource_compositions_state_queued_at_idx" to table: "resource_compositions"
DROP INDEX "resource_compositions_state_queued_at_idx";
-- reverse: create index "resource_compositions_resource_id_idx" to table: "resource_compositions"
DROP INDEX "resource_compositions_resource_id_idx";
-- reverse: create index "resource_compositions_creator_id_state_idx" to table: "resource_compositions"
DROP INDEX "resource_compositions_creator_id_state_idx";
-- reverse: create "resource_compositions" table
DROP TABLE "resource_compositions";
