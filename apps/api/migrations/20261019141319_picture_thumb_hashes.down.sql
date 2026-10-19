-- reverse: modify "game_images" table
ALTER TABLE "game_images" DROP COLUMN "thumb_hash";
-- reverse: modify "game_developers" table
ALTER TABLE "game_developers" DROP COLUMN "logo_thumb_hash";
-- reverse: modify "game_covers" table
ALTER TABLE "game_covers" DROP COLUMN "thumb_hash";
-- reverse: modify "game_characters" table
ALTER TABLE "game_characters" DROP COLUMN "image_thumb_hash";
-- reverse: modify "game_character_relations" table
ALTER TABLE "game_character_relations" DROP COLUMN "image_thumb_hash";
