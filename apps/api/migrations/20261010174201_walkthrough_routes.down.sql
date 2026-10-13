DROP INDEX "walkthroughs_game_id_creator_id_key";

ALTER TABLE "walkthroughs"
    ADD COLUMN "excerpt" text NOT NULL DEFAULT '',
    ADD COLUMN "content" jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
    ADD COLUMN "title" character varying(255) NOT NULL DEFAULT '';

UPDATE "walkthroughs" SET "content" = "note" WHERE "note" IS NOT NULL;

UPDATE "walkthroughs" AS w
SET "title" = l."title", "content" = l."content", "text" = l."text", "excerpt" = l."excerpt", "status" = l."status", "review_pending" = l."review_pending"
FROM "legacy_walkthrough_articles" AS l
WHERE l."id" = w."id";

ALTER TABLE "walkthroughs" ALTER COLUMN "content" DROP DEFAULT, ALTER COLUMN "title" DROP DEFAULT, DROP COLUMN "routes", DROP COLUMN "note";

DROP TABLE "legacy_walkthrough_articles";
