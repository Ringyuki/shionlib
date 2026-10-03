-- create index "game_character_relations_character_id_idx" to table: "game_character_relations"
CREATE INDEX "game_character_relations_character_id_idx" ON "game_character_relations" ("character_id");
-- create index "game_characters_name_en_trgm_idx" to table: "game_characters"
CREATE INDEX "game_characters_name_en_trgm_idx" ON "game_characters" USING gin ("name_en" gin_trgm_ops);
-- create index "game_characters_name_jp_trgm_idx" to table: "game_characters"
CREATE INDEX "game_characters_name_jp_trgm_idx" ON "game_characters" USING gin ("name_jp" gin_trgm_ops);
-- create index "game_characters_name_zh_trgm_idx" to table: "game_characters"
CREATE INDEX "game_characters_name_zh_trgm_idx" ON "game_characters" USING gin ("name_zh" gin_trgm_ops);
-- create index "game_covers_game_id_idx" to table: "game_covers"
CREATE INDEX "game_covers_game_id_idx" ON "game_covers" ("game_id");
-- create index "game_covers_rated_game_id_idx" to table: "game_covers"
CREATE INDEX "game_covers_rated_game_id_idx" ON "game_covers" ("game_id") WHERE (sexual > 0);
-- create index "game_developer_relations_developer_id_idx" to table: "game_developer_relations"
CREATE INDEX "game_developer_relations_developer_id_idx" ON "game_developer_relations" ("developer_id");
-- create index "game_developers_name_trgm_idx" to table: "game_developers"
CREATE INDEX "game_developers_name_trgm_idx" ON "game_developers" USING gin ("name" gin_trgm_ops);
-- create index "game_developers_parent_developer_id_idx" to table: "game_developers"
CREATE INDEX "game_developers_parent_developer_id_idx" ON "game_developers" ("parent_developer_id");
-- create index "game_images_game_id_idx" to table: "game_images"
CREATE INDEX "game_images_game_id_idx" ON "game_images" ("game_id");
-- create index "game_links_game_id_idx" to table: "game_links"
CREATE INDEX "game_links_game_id_idx" ON "game_links" ("game_id");
-- create index "games_platform_idx" to table: "games"
CREATE INDEX "games_platform_idx" ON "games" USING gin ("platform");
-- create index "games_title_en_trgm_idx" to table: "games"
CREATE INDEX "games_title_en_trgm_idx" ON "games" USING gin ("title_en" gin_trgm_ops);
-- create index "games_title_jp_trgm_idx" to table: "games"
CREATE INDEX "games_title_jp_trgm_idx" ON "games" USING gin ("title_jp" gin_trgm_ops);
-- create index "games_title_zh_trgm_idx" to table: "games"
CREATE INDEX "games_title_zh_trgm_idx" ON "games" USING gin ("title_zh" gin_trgm_ops);
-- create index "tags_name_trgm_idx" to table: "tags"
CREATE INDEX "tags_name_trgm_idx" ON "tags" USING gin ("name" gin_trgm_ops);
