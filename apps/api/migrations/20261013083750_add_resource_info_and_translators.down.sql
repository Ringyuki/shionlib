-- reverse: create index "game_download_resource_translators_translator_id_idx" to table: "game_download_resource_translators"
DROP INDEX "game_download_resource_translators_translator_id_idx";
-- reverse: create index "game_download_resource_translators_pair_key" to table: "game_download_resource_translators"
DROP INDEX "game_download_resource_translators_pair_key";
-- reverse: create "game_download_resource_translators" table
DROP TABLE "game_download_resource_translators";
-- reverse: create index "translators_name_key_key" to table: "translators"
DROP INDEX "translators_name_key_key";
-- reverse: create index "translators_alias_keys_idx" to table: "translators"
DROP INDEX "translators_alias_keys_idx";
-- reverse: create "translators" table
DROP TABLE "translators";
-- reverse: create index "translator_distinctions_low_id_high_id_key" to table: "translator_distinctions"
DROP INDEX "translator_distinctions_low_id_high_id_key";
-- reverse: create "translator_distinctions" table
DROP TABLE "translator_distinctions";
-- reverse: modify "game_download_resources" table
ALTER TABLE "game_download_resources" DROP COLUMN "extras", DROP COLUMN "form", DROP COLUMN "edition_name", DROP COLUMN "edition", DROP COLUMN "release_url", DROP COLUMN "patch_version", DROP COLUMN "translation";
