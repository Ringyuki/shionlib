-- reverse: create index "tags_name_trgm_idx" to table: "tags"
DROP INDEX "tags_name_trgm_idx";
-- reverse: create index "games_title_zh_trgm_idx" to table: "games"
DROP INDEX "games_title_zh_trgm_idx";
-- reverse: create index "games_title_jp_trgm_idx" to table: "games"
DROP INDEX "games_title_jp_trgm_idx";
-- reverse: create index "games_title_en_trgm_idx" to table: "games"
DROP INDEX "games_title_en_trgm_idx";
-- reverse: create index "games_platform_idx" to table: "games"
DROP INDEX "games_platform_idx";
-- reverse: create index "game_links_game_id_idx" to table: "game_links"
DROP INDEX "game_links_game_id_idx";
-- reverse: create index "game_images_game_id_idx" to table: "game_images"
DROP INDEX "game_images_game_id_idx";
-- reverse: create index "game_developers_parent_developer_id_idx" to table: "game_developers"
DROP INDEX "game_developers_parent_developer_id_idx";
-- reverse: create index "game_developers_name_trgm_idx" to table: "game_developers"
DROP INDEX "game_developers_name_trgm_idx";
-- reverse: create index "game_developer_relations_developer_id_idx" to table: "game_developer_relations"
DROP INDEX "game_developer_relations_developer_id_idx";
-- reverse: create index "game_covers_rated_game_id_idx" to table: "game_covers"
DROP INDEX "game_covers_rated_game_id_idx";
-- reverse: create index "game_covers_game_id_idx" to table: "game_covers"
DROP INDEX "game_covers_game_id_idx";
-- reverse: create index "game_characters_name_zh_trgm_idx" to table: "game_characters"
DROP INDEX "game_characters_name_zh_trgm_idx";
-- reverse: create index "game_characters_name_jp_trgm_idx" to table: "game_characters"
DROP INDEX "game_characters_name_jp_trgm_idx";
-- reverse: create index "game_characters_name_en_trgm_idx" to table: "game_characters"
DROP INDEX "game_characters_name_en_trgm_idx";
-- reverse: create index "game_character_relations_character_id_idx" to table: "game_character_relations"
DROP INDEX "game_character_relations_character_id_idx";
