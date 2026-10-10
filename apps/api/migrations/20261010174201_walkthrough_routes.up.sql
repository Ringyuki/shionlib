CREATE TABLE "legacy_walkthrough_articles" (
    "id" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "content" jsonb NOT NULL,
    "text" text NOT NULL,
    "excerpt" text NOT NULL,
    "status" "walkthrough_status" NOT NULL,
    "review_pending" boolean NOT NULL,
    PRIMARY KEY ("id")
);

INSERT INTO "legacy_walkthrough_articles" ("id", "title", "content", "text", "excerpt", "status", "review_pending")
SELECT "id", "title", "content", "text", "excerpt", "status", "review_pending" FROM "walkthroughs";

ALTER TABLE "walkthroughs" ADD COLUMN "note" jsonb NULL, ADD COLUMN "routes" jsonb NOT NULL DEFAULT '[]';

WITH "ranked" AS (
    SELECT "id", "text", "created", ("status" = 'PUBLISHED') AS "public",
        first_value("id") OVER "written" AS "kept",
        first_value("status" = 'PUBLISHED') OVER "written" AS "kept_public"
    FROM "walkthroughs"
    WHERE "status" <> 'DELETED'
    WINDOW "written" AS (PARTITION BY "game_id", "creator_id" ORDER BY ("status" = 'PUBLISHED') DESC, "created", "id")
), "merged" AS (
    SELECT "kept", string_agg("text", E'\n\n' ORDER BY "created", "id") AS "text"
    FROM "ranked"
    WHERE "public" = "kept_public" AND btrim("text") <> ''
    GROUP BY "kept"
    HAVING count(*) > 1
)
UPDATE "walkthroughs" AS w
SET "text" = "merged"."text"
FROM "merged"
WHERE w."id" = "merged"."kept";

UPDATE "walkthroughs"
SET "status" = 'DELETED', "review_pending" = false
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", row_number() OVER (PARTITION BY "game_id", "creator_id" ORDER BY ("status" = 'PUBLISHED') DESC, "created", "id") AS "position"
        FROM "walkthroughs"
        WHERE "status" <> 'DELETED'
    ) AS "written"
    WHERE "position" > 1
);

UPDATE "walkthroughs" AS w
SET "note" = jsonb_build_object('type', 'doc', 'content', "said"."paragraphs")
FROM (
    SELECT s."id", jsonb_agg(
        CASE
            WHEN btrim(l."line", E' \t\r') = '' THEN jsonb_build_object('type', 'paragraph')
            ELSE jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', btrim(l."line", E' \t\r'))))
        END
        ORDER BY l."position"
    ) AS "paragraphs"
    FROM "walkthroughs" AS s
    CROSS JOIN LATERAL regexp_split_to_table(btrim(s."text", E' \t\r\n'), E'\n') WITH ORDINALITY AS l("line", "position")
    WHERE btrim(s."text", E' \t\r\n') <> ''
    GROUP BY s."id"
) AS "said"
WHERE w."id" = "said"."id";

ALTER TABLE "walkthroughs" DROP COLUMN "title", DROP COLUMN "content", DROP COLUMN "excerpt";

CREATE UNIQUE INDEX "walkthroughs_game_id_creator_id_key" ON "walkthroughs" ("game_id", "creator_id") WHERE (status <> 'DELETED'::walkthrough_status);
