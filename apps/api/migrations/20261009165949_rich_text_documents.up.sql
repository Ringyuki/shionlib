CREATE TABLE "legacy_editor_contents" (
    "source" text NOT NULL,
    "id" integer NOT NULL,
    "content" jsonb NOT NULL,
    "html" text NULL,
    PRIMARY KEY ("source", "id")
);

INSERT INTO "legacy_editor_contents" ("source", "id", "content", "html")
SELECT 'comment', "id", "content", "html" FROM "comments";

INSERT INTO "legacy_editor_contents" ("source", "id", "content", "html")
SELECT 'walkthrough', "id", "content", "html" FROM "walkthroughs";

CREATE FUNCTION pg_temp.rich_link(address text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN btrim(address) ~* '^(https?://|mailto:)[^[:space:][:cntrl:]]+$' AND char_length(btrim(address)) <= 2000
        THEN btrim(address)
    END
$$;

CREATE FUNCTION pg_temp.rich_has_mark(marks jsonb, kind text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(marks) AS mark WHERE mark->>'type' = kind)
$$;

CREATE FUNCTION pg_temp.rich_text_node(body text, format integer, inherited jsonb, article boolean) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN body IS NULL OR body = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', body) ||
            CASE WHEN jsonb_array_length(marks.own || inherited) > 0
                THEN jsonb_build_object('marks', marks.own || inherited)
                ELSE '{}'::jsonb
            END
        )
    END
    FROM (
        SELECT
            CASE WHEN format & 1 <> 0 THEN '[{"type":"bold"}]'::jsonb ELSE '[]'::jsonb END ||
            CASE WHEN article AND format & 2 <> 0 THEN '[{"type":"italic"}]'::jsonb ELSE '[]'::jsonb END ||
            CASE WHEN article AND format & 4 <> 0 THEN '[{"type":"strike"}]'::jsonb ELSE '[]'::jsonb END AS own
    ) AS marks
$$;

CREATE FUNCTION pg_temp.rich_inline(node jsonb, inherited jsonb, article boolean) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    kind text := node->>'type';
    address text;
    child jsonb;
    result jsonb := '[]'::jsonb;
BEGIN
    IF kind = 'linebreak' THEN
        RETURN '[{"type":"hard_break"}]'::jsonb;
    END IF;
    IF kind = 'tab' THEN
        RETURN pg_temp.rich_text_node(E'\t', 0, inherited, article);
    END IF;
    IF kind IN ('link', 'autolink') OR kind = 'image' THEN
        address := pg_temp.rich_link(CASE WHEN kind = 'image' THEN node->>'src' ELSE node->>'url' END);
        IF address IS NOT NULL AND NOT pg_temp.rich_has_mark(inherited, 'link') THEN
            inherited := inherited || jsonb_build_array(jsonb_build_object('type', 'link', 'attrs', jsonb_build_object('href', address)));
        END IF;
    END IF;
    IF kind = 'spoiler' AND NOT pg_temp.rich_has_mark(inherited, 'spoiler') THEN
        inherited := inherited || '[{"type":"spoiler"}]'::jsonb;
    END IF;
    IF kind = 'image' THEN
        RETURN pg_temp.rich_text_node(COALESCE(NULLIF(btrim(node->>'altText'), ''), address), 0, inherited, article);
    END IF;
    IF jsonb_typeof(node->'children') = 'array' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(node->'children') LOOP
            result := result || pg_temp.rich_inline(child, inherited, article);
        END LOOP;
        RETURN result;
    END IF;
    RETURN pg_temp.rich_text_node(
        node->>'text',
        CASE WHEN jsonb_typeof(node->'format') = 'number' THEN (node->>'format')::numeric::integer ELSE 0 END,
        inherited,
        article
    );
END
$$;

CREATE FUNCTION pg_temp.rich_paragraph(inline jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('type', 'paragraph') ||
        CASE WHEN jsonb_array_length(inline) > 0 THEN jsonb_build_object('content', inline) ELSE '{}'::jsonb END
$$;

CREATE FUNCTION pg_temp.rich_span(raw jsonb) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN jsonb_typeof(raw) = 'number' THEN LEAST(GREATEST((raw #>> '{}')::numeric::integer, 1), 50) ELSE 1 END
$$;

CREATE FUNCTION pg_temp.rich_cell(cell jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    child jsonb;
    paragraphs jsonb := '[]'::jsonb;
BEGIN
    IF jsonb_typeof(cell->'children') = 'array' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(cell->'children') LOOP
            paragraphs := paragraphs || jsonb_build_array(
                pg_temp.rich_paragraph(pg_temp.rich_inline(child || '{"type":"overflow"}'::jsonb, '[]'::jsonb, true))
            );
        END LOOP;
    END IF;
    IF jsonb_array_length(paragraphs) = 0 THEN
        paragraphs := '[{"type":"paragraph"}]'::jsonb;
    END IF;
    RETURN jsonb_build_object(
        'type', CASE WHEN jsonb_typeof(cell->'headerState') = 'number' AND (cell->>'headerState')::numeric > 0 THEN 'table_header' ELSE 'table_cell' END,
        'attrs', jsonb_build_object('colspan', pg_temp.rich_span(cell->'colSpan'), 'rowspan', pg_temp.rich_span(cell->'rowSpan')),
        'content', paragraphs
    );
END
$$;

CREATE FUNCTION pg_temp.rich_table(node jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    line jsonb;
    cell jsonb;
    cells jsonb;
    lines jsonb := '[]'::jsonb;
BEGIN
    FOR line IN SELECT value FROM jsonb_array_elements(node->'children') WHERE value->>'type' = 'tablerow' AND jsonb_typeof(value->'children') = 'array' LOOP
        cells := '[]'::jsonb;
        FOR cell IN SELECT value FROM jsonb_array_elements(line->'children') WHERE value->>'type' = 'tablecell' LOOP
            cells := cells || jsonb_build_array(pg_temp.rich_cell(cell));
        END LOOP;
        IF jsonb_array_length(cells) > 0 THEN
            lines := lines || jsonb_build_array(jsonb_build_object('type', 'table_row', 'content', cells));
        END IF;
    END LOOP;
    IF jsonb_array_length(lines) = 0 THEN
        RETURN '[]'::jsonb;
    END IF;
    RETURN jsonb_build_array(jsonb_build_object('type', 'table', 'content', lines));
END
$$;

CREATE FUNCTION pg_temp.rich_blocks(node jsonb, article boolean) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    kind text := node->>'type';
    children jsonb := CASE WHEN jsonb_typeof(node->'children') = 'array' THEN node->'children' ELSE '[]'::jsonb END;
    child jsonb;
    inline jsonb := '[]'::jsonb;
    nested jsonb := '[]'::jsonb;
    result jsonb := '[]'::jsonb;
BEGIN
    IF article AND kind = 'heading' THEN
        inline := pg_temp.rich_inline(node || '{"type":"overflow"}'::jsonb, '[]'::jsonb, article);
        RETURN jsonb_build_array(
            jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', CASE WHEN node->>'tag' IN ('h1', 'h2') THEN 2 ELSE 3 END)) ||
            CASE WHEN jsonb_array_length(inline) > 0 THEN jsonb_build_object('content', inline) ELSE '{}'::jsonb END
        );
    END IF;
    IF article AND kind = 'quote' THEN
        RETURN jsonb_build_array(jsonb_build_object(
            'type', 'blockquote',
            'content', jsonb_build_array(pg_temp.rich_paragraph(pg_temp.rich_inline(node || '{"type":"overflow"}'::jsonb, '[]'::jsonb, article)))
        ));
    END IF;
    IF article AND kind = 'horizontalrule' THEN
        RETURN '[{"type":"horizontal_rule"}]'::jsonb;
    END IF;
    IF article AND kind = 'table' THEN
        RETURN pg_temp.rich_table(node);
    END IF;
    IF article AND kind = 'list' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(children) WHERE value->>'type' = 'listitem' LOOP
            result := result || pg_temp.rich_blocks(child, article);
        END LOOP;
        IF jsonb_array_length(result) = 0 THEN
            RETURN result;
        END IF;
        RETURN jsonb_build_array(jsonb_build_object(
            'type', CASE WHEN node->>'listType' = 'number' THEN 'ordered_list' ELSE 'bullet_list' END,
            'content', result
        ));
    END IF;
    FOR child IN SELECT value FROM jsonb_array_elements(children) LOOP
        IF child->>'type' IN ('root', 'paragraph', 'heading', 'quote', 'list', 'listitem', 'code', 'table', 'tablerow', 'tablecell', 'layout-container', 'layout-item', 'horizontalrule') THEN
            IF article AND kind = 'listitem' THEN
                nested := nested || pg_temp.rich_blocks(child, article);
                CONTINUE;
            END IF;
            IF jsonb_array_length(inline) > 0 THEN
                result := result || jsonb_build_array(pg_temp.rich_paragraph(inline));
                inline := '[]'::jsonb;
            END IF;
            result := result || pg_temp.rich_blocks(child, article);
        ELSE
            inline := inline || pg_temp.rich_inline(child, '[]'::jsonb, article);
        END IF;
    END LOOP;
    IF article AND kind = 'listitem' THEN
        RETURN jsonb_build_array(jsonb_build_object('type', 'list_item', 'content', jsonb_build_array(pg_temp.rich_paragraph(inline)) || nested));
    END IF;
    IF jsonb_array_length(inline) > 0 OR (kind = 'paragraph' AND jsonb_array_length(result) = 0) THEN
        result := result || jsonb_build_array(pg_temp.rich_paragraph(inline));
    END IF;
    RETURN result;
END
$$;

CREATE FUNCTION pg_temp.rich_document(content jsonb, article boolean) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object('type', 'doc', 'content', CASE WHEN jsonb_array_length(blocks.found) > 0 THEN blocks.found ELSE '[{"type":"paragraph"}]'::jsonb END)
    FROM (
        SELECT CASE WHEN jsonb_typeof(content->'root') = 'object'
            THEN pg_temp.rich_blocks(content->'root' || '{"type":"root"}'::jsonb, article)
            ELSE '[]'::jsonb
        END AS found
    ) AS blocks
$$;

CREATE FUNCTION pg_temp.rich_plain(node jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    kind text := node->>'type';
    child jsonb;
    result text := '';
BEGIN
    IF kind = 'text' THEN
        RETURN COALESCE(node->>'text', '');
    END IF;
    IF kind = 'hard_break' THEN
        RETURN E'\n';
    END IF;
    IF jsonb_typeof(node->'content') = 'array' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(node->'content') LOOP
            result := result || pg_temp.rich_plain(child);
        END LOOP;
    END IF;
    IF kind IN ('paragraph', 'heading') THEN
        result := result || E'\n';
    END IF;
    RETURN result;
END
$$;

CREATE FUNCTION pg_temp.rich_open(node jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    kind text := node->>'type';
    child jsonb;
    result text := '';
BEGIN
    IF kind = 'text' THEN
        IF pg_temp.rich_has_mark(COALESCE(node->'marks', '[]'::jsonb), 'spoiler') THEN
            RETURN '';
        END IF;
        RETURN COALESCE(node->>'text', '');
    END IF;
    IF jsonb_typeof(node->'content') = 'array' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(node->'content') LOOP
            result := result || pg_temp.rich_open(child);
        END LOOP;
    END IF;
    RETURN result || ' ';
END
$$;

UPDATE "comments" SET "content" = pg_temp.rich_document("content", false) WHERE "content"->>'type' IS DISTINCT FROM 'doc';

UPDATE "walkthroughs" SET "content" = pg_temp.rich_document("content", true) WHERE "content"->>'type' IS DISTINCT FROM 'doc';

ALTER TABLE "comments" DROP COLUMN "html", ADD COLUMN "text" text NOT NULL DEFAULT '';

ALTER TABLE "walkthroughs" DROP COLUMN "html", ADD COLUMN "text" text NOT NULL DEFAULT '', ADD COLUMN "excerpt" text NOT NULL DEFAULT '';

UPDATE "comments" SET "text" = rtrim(pg_temp.rich_plain("content"), E'\n');

UPDATE "walkthroughs" SET "text" = rtrim(pg_temp.rich_plain("content"), E'\n');

UPDATE "walkthroughs" SET "excerpt" = rtrim(left(btrim(regexp_replace(pg_temp.rich_open("content"), '\s+', ' ', 'g')), 200));
