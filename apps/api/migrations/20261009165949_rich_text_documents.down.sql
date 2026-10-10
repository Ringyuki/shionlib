ALTER TABLE "walkthroughs" DROP COLUMN "text", DROP COLUMN "excerpt", ADD COLUMN "html" character varying(100000) NOT NULL DEFAULT '';

ALTER TABLE "comments" DROP COLUMN "text", ADD COLUMN "html" character varying(100000) NULL;

UPDATE "walkthroughs" AS w
SET "content" = l."content", "html" = COALESCE(l."html", '')
FROM "legacy_editor_contents" AS l
WHERE l."source" = 'walkthrough' AND l."id" = w."id";

UPDATE "comments" AS c
SET "content" = l."content", "html" = l."html"
FROM "legacy_editor_contents" AS l
WHERE l."source" = 'comment' AND l."id" = c."id";

ALTER TABLE "walkthroughs" ALTER COLUMN "html" DROP DEFAULT;

DROP TABLE "legacy_editor_contents";
