-- modify "game_download_resources" table
ALTER TABLE "game_download_resources" ADD COLUMN "translation" character varying(16) NULL, ADD COLUMN "patch_version" character varying(32) NULL, ADD COLUMN "release_url" character varying(512) NULL, ADD COLUMN "edition" character varying(16) NULL, ADD COLUMN "edition_name" character varying(64) NULL, ADD COLUMN "form" character varying(16) NULL, ADD COLUMN "extras" text[] NULL DEFAULT ARRAY[]::text[];
-- create "translator_distinctions" table
CREATE TABLE "translator_distinctions" ("id" serial NOT NULL, "low_id" integer NOT NULL, "high_id" integer NOT NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"));
-- create index "translator_distinctions_low_id_high_id_key" to table: "translator_distinctions"
CREATE UNIQUE INDEX "translator_distinctions_low_id_high_id_key" ON "translator_distinctions" ("low_id", "high_id");
-- create "translators" table
CREATE TABLE "translators" ("id" serial NOT NULL, "name" character varying(64) NOT NULL, "name_key" character varying(64) NOT NULL, "aliases" text[] NULL DEFAULT ARRAY[]::text[], "alias_keys" text[] NULL DEFAULT ARRAY[]::text[], "homepage" character varying(512) NULL, "creator_id" integer NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create index "translators_alias_keys_idx" to table: "translators"
CREATE INDEX "translators_alias_keys_idx" ON "translators" USING gin ("alias_keys");
-- create index "translators_name_key_key" to table: "translators"
CREATE UNIQUE INDEX "translators_name_key_key" ON "translators" ("name_key");
-- create "game_download_resource_translators" table
CREATE TABLE "game_download_resource_translators" ("id" serial NOT NULL, "position" integer NOT NULL DEFAULT 0, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resource_id" integer NOT NULL, "translator_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "game_download_resource_translators_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "game_download_resources" ("id") ON UPDATE CASCADE ON DELETE CASCADE, CONSTRAINT "game_download_resource_translators_translator_id_fkey" FOREIGN KEY ("translator_id") REFERENCES "translators" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "game_download_resource_translators_pair_key" to table: "game_download_resource_translators"
CREATE UNIQUE INDEX "game_download_resource_translators_pair_key" ON "game_download_resource_translators" ("resource_id", "translator_id");
-- create index "game_download_resource_translators_translator_id_idx" to table: "game_download_resource_translators"
CREATE INDEX "game_download_resource_translators_translator_id_idx" ON "game_download_resource_translators" ("translator_id");
