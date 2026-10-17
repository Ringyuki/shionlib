-- create "patch_page_assignments" table
CREATE TABLE "patch_page_assignments" ("id" serial NOT NULL, "page_ids" text[] NULL DEFAULT ARRAY[]::text[], "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, "game_id" integer NOT NULL, "assigned_by" integer NULL, PRIMARY KEY ("id"), CONSTRAINT "patch_page_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE SET NULL, CONSTRAINT "patch_page_assignments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "patch_page_assignments_game_id_key" to table: "patch_page_assignments"
CREATE UNIQUE INDEX "patch_page_assignments_game_id_key" ON "patch_page_assignments" ("game_id");
