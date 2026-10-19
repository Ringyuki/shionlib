-- modify "game_character_relations" table
ALTER TABLE "game_character_relations" ADD COLUMN "image_thumb_hash" text NULL;
-- modify "game_characters" table
ALTER TABLE "game_characters" ADD COLUMN "image_thumb_hash" text NULL;
-- modify "game_covers" table
ALTER TABLE "game_covers" ADD COLUMN "thumb_hash" text NULL;
-- modify "game_developers" table
ALTER TABLE "game_developers" ADD COLUMN "logo_thumb_hash" text NULL;
-- modify "game_images" table
ALTER TABLE "game_images" ADD COLUMN "thumb_hash" text NULL;
