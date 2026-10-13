-- modify "game_tag_relations" table
ALTER TABLE "game_tag_relations" ADD PRIMARY KEY ("game_id", "tag_id");
