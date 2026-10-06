-- create "settings" table
CREATE TABLE "settings" ("id" serial NOT NULL, "name" character varying(128) NOT NULL, "value" jsonb NOT NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create index "settings_name_key" to table: "settings"
CREATE UNIQUE INDEX "settings_name_key" ON "settings" ("name");
-- create "setting_changes" table
CREATE TABLE "setting_changes" ("id" serial NOT NULL, "name" character varying(128) NOT NULL, "previous" jsonb NULL, "value" jsonb NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "actor_id" integer NULL, PRIMARY KEY ("id"), CONSTRAINT "setting_changes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE SET NULL);
-- create index "setting_changes_name_created_idx" to table: "setting_changes"
CREATE INDEX "setting_changes_name_created_idx" ON "setting_changes" ("name", "created");
