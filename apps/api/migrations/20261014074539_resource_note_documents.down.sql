CREATE FUNCTION pg_temp.note_bbcode_leaf(node jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN node->>'type' = 'hard_break' THEN E'\n'
        ELSE
            CASE WHEN marks.spoiler THEN '[spoiler]' ELSE '' END ||
            CASE WHEN marks.href IS NOT NULL THEN '[url=' || marks.href || ']' ELSE '' END ||
            CASE WHEN marks.bold THEN '[b]' ELSE '' END ||
            (node->>'text') ||
            CASE WHEN marks.bold THEN '[/b]' ELSE '' END ||
            CASE WHEN marks.href IS NOT NULL THEN '[/url]' ELSE '' END ||
            CASE WHEN marks.spoiler THEN '[/spoiler]' ELSE '' END
    END
    FROM (
        SELECT
            coalesce(node->'marks', '[]'::jsonb) @> '[{"type":"bold"}]' AS bold,
            coalesce(node->'marks', '[]'::jsonb) @> '[{"type":"spoiler"}]' AS spoiler,
            (SELECT mark->'attrs'->>'href' FROM jsonb_array_elements(coalesce(node->'marks', '[]'::jsonb)) AS mark WHERE mark->>'type' = 'link' LIMIT 1) AS href
    ) AS marks
$$;

CREATE FUNCTION pg_temp.note_bbcode(document jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT NULLIF(left(btrim(string_agg(paragraph.said, E'\n\n' ORDER BY paragraph.n), E'\n'), 255), '')
    FROM (
        SELECT p.n, coalesce((
            SELECT string_agg(pg_temp.note_bbcode_leaf(i.node), '' ORDER BY i.m)
            FROM jsonb_array_elements(p.node->'content') WITH ORDINALITY AS i(node, m)
        ), '') AS said
        FROM jsonb_array_elements(document->'content') WITH ORDINALITY AS p(node, n)
    ) AS paragraph
$$;

ALTER TABLE "game_download_resources" DROP COLUMN "note_text", ALTER COLUMN "note" TYPE character varying(255) USING pg_temp.note_bbcode("note");
