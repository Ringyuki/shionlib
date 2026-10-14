-- create "friend_links" table
CREATE TABLE "friend_links" ("id" serial NOT NULL, "name" character varying(50) NOT NULL, "url" character varying(500) NOT NULL, "logo" character varying(500) NULL, "description" character varying(200) NOT NULL DEFAULT '', "visible" boolean NOT NULL DEFAULT true, "position" integer NOT NULL DEFAULT 0, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create index "friend_links_position_idx" to table: "friend_links"
CREATE INDEX "friend_links_position_idx" ON "friend_links" ("position");
