CREATE FUNCTION pg_temp.note_link(target text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN btrim(target) ~* '^/[a-z][0-9]+(\.[0-9]+)?(#[^[:space:]]*)?$' THEN 'https://vndb.org/' || substr(btrim(target), 2)
        WHEN btrim(target) ~* '^https?://[^[:space:][:cntrl:]]+$' AND char_length(btrim(target)) <= 2000 THEN btrim(target)
    END
$$;

CREATE FUNCTION pg_temp.note_plain(document jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT rtrim(coalesce(string_agg(paragraph.said || E'\n', '' ORDER BY paragraph.n), ''), E'\n')
    FROM (
        SELECT p.n, coalesce((
            SELECT string_agg(CASE WHEN i.node->>'type' = 'hard_break' THEN E'\n' ELSE i.node->>'text' END, '' ORDER BY i.m)
            FROM jsonb_array_elements(p.node->'content') WITH ORDINALITY AS i(node, m)
        ), '') AS said
        FROM jsonb_array_elements(document->'content') WITH ORDINALITY AS p(node, n)
    ) AS paragraph
$$;

CREATE FUNCTION pg_temp.note_document(source text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    pattern text := '(\[(/?)([a-zA-Z]+)(?:=([^]' || chr(10) || ']+))?\])';
    paragraph_break text := chr(1);
    body text;
    pieces text[];
    raws text[];
    slashes text[];
    names text[];
    vals text[];
    kinds text[] := '{}';
    texts text[] := '{}';
    tags text[] := '{}';
    tag_values text[] := '{}';
    closings boolean[] := '{}';
    partners int[];
    hrefs text[];
    stack int[] := '{}';
    active int[] := '{}';
    tag text;
    closing boolean;
    depth int;
    total int;
    k int;
    marks jsonb;
    href text;
    part text;
    line text;
    first_part boolean;
    first_line boolean;
    last jsonb;
    leaf jsonb;
    inline jsonb := '[]'::jsonb;
    paragraphs jsonb := '[]'::jsonb;
    document jsonb;
BEGIN
    IF source IS NULL THEN
        RETURN NULL;
    END IF;
    body := btrim(replace(replace(source, E'\r\n', E'\n'), E'\r', E'\n'), E' \t\n');
    IF body = '' THEN
        RETURN NULL;
    END IF;
    body := regexp_replace(body, E'\n[ \t]*\n[ \t\n]*', paragraph_break, 'g');
    pieces := regexp_split_to_array(body, pattern);
    SELECT array_agg(m[1] ORDER BY n), array_agg(m[2] ORDER BY n), array_agg(lower(m[3]) ORDER BY n), array_agg(m[4] ORDER BY n)
    INTO raws, slashes, names, vals
    FROM regexp_matches(body, pattern, 'g') WITH ORDINALITY AS found(m, n);
    FOR i IN 1..array_length(pieces, 1) LOOP
        IF pieces[i] <> '' THEN
            kinds := kinds || 'text'::text; texts := texts || pieces[i]; tags := tags || NULL::text; tag_values := tag_values || NULL::text; closings := closings || false;
        END IF;
        IF i <= coalesce(array_length(raws, 1), 0) THEN
            tag := names[i];
            closing := slashes[i] = '/';
            IF tag IN ('b', 'i', 'u', 's', 'quote', 'spoiler', 'mask', 'url', 'size', 'color')
                AND (vals[i] IS NULL OR (NOT closing AND tag IN ('url', 'size', 'color'))) THEN
                kinds := kinds || 'tag'::text; texts := texts || raws[i]; tags := tags || tag; tag_values := tag_values || vals[i]; closings := closings || closing;
            ELSE
                kinds := kinds || 'text'::text; texts := texts || raws[i]; tags := tags || NULL::text; tag_values := tag_values || NULL::text; closings := closings || false;
            END IF;
        END IF;
    END LOOP;
    total := coalesce(array_length(kinds, 1), 0);
    partners := array_fill(0, ARRAY[greatest(total, 1)]);
    hrefs := array_fill(NULL::text, ARRAY[greatest(total, 1)]);
    FOR i IN 1..total LOOP
        IF kinds[i] = 'tag' THEN
            IF NOT closings[i] THEN
                stack := stack || i;
            ELSE
                depth := 0;
                FOR k IN REVERSE coalesce(array_length(stack, 1), 0)..1 LOOP
                    IF tags[stack[k]] = tags[i] THEN
                        depth := k;
                        EXIT;
                    END IF;
                END LOOP;
                IF depth > 0 THEN
                    partners[stack[depth]] := i;
                    partners[i] := stack[depth];
                    stack := stack[1:depth - 1];
                END IF;
            END IF;
        END IF;
    END LOOP;
    FOR i IN 1..total LOOP
        IF kinds[i] = 'tag' AND tags[i] = 'url' AND NOT closings[i] AND partners[i] > 0 THEN
            IF tag_values[i] IS NOT NULL THEN
                hrefs[i] := pg_temp.note_link(tag_values[i]);
            ELSE
                SELECT pg_temp.note_link(replace(string_agg(texts[inner_at.at], '' ORDER BY inner_at.at), paragraph_break, ' '))
                INTO href
                FROM generate_series(i + 1, partners[i] - 1) AS inner_at(at)
                WHERE kinds[inner_at.at] = 'text' OR partners[inner_at.at] = 0;
                hrefs[i] := href;
            END IF;
        END IF;
    END LOOP;
    FOR i IN 1..total LOOP
        IF kinds[i] = 'tag' AND partners[i] > 0 THEN
            IF closings[i] THEN
                active := array_remove(active, partners[i]);
            ELSE
                active := active || i;
            END IF;
            CONTINUE;
        END IF;
        marks := '[]'::jsonb;
        IF EXISTS (SELECT 1 FROM unnest(active) AS opened(at) WHERE tags[opened.at] = 'b') THEN
            marks := marks || '[{"type":"bold"}]'::jsonb;
        END IF;
        href := NULL;
        FOR k IN REVERSE coalesce(array_length(active, 1), 0)..1 LOOP
            IF tags[active[k]] = 'url' THEN
                href := hrefs[active[k]];
                EXIT;
            END IF;
        END LOOP;
        IF href IS NOT NULL THEN
            marks := marks || jsonb_build_array(jsonb_build_object('type', 'link', 'attrs', jsonb_build_object('href', href)));
        END IF;
        IF EXISTS (SELECT 1 FROM unnest(active) AS opened(at) WHERE tags[opened.at] IN ('spoiler', 'mask')) THEN
            marks := marks || '[{"type":"spoiler"}]'::jsonb;
        END IF;
        first_part := true;
        FOREACH part IN ARRAY string_to_array(texts[i], paragraph_break) LOOP
            IF NOT first_part THEN
                paragraphs := paragraphs || jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', inline));
                inline := '[]'::jsonb;
            END IF;
            first_part := false;
            first_line := true;
            FOREACH line IN ARRAY string_to_array(part, E'\n') LOOP
                IF NOT first_line THEN
                    inline := inline || '[{"type":"hard_break"}]'::jsonb;
                END IF;
                first_line := false;
                CONTINUE WHEN line = '';
                last := inline -> -1;
                IF last ->> 'type' = 'text' AND coalesce(last -> 'marks', '[]'::jsonb) = marks THEN
                    inline := jsonb_set(inline, ARRAY[(jsonb_array_length(inline) - 1)::text, 'text'], to_jsonb((last ->> 'text') || line));
                ELSE
                    leaf := jsonb_build_object('type', 'text', 'text', line);
                    IF jsonb_array_length(marks) > 0 THEN
                        leaf := leaf || jsonb_build_object('marks', marks);
                    END IF;
                    inline := inline || jsonb_build_array(leaf);
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    paragraphs := paragraphs || jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', inline));
    SELECT jsonb_agg(CASE WHEN jsonb_array_length(p.node -> 'content') = 0 THEN '{"type":"paragraph"}'::jsonb ELSE p.node END ORDER BY p.n)
    INTO paragraphs
    FROM jsonb_array_elements(paragraphs) WITH ORDINALITY AS p(node, n);
    document := jsonb_build_object('type', 'doc', 'content', paragraphs);
    IF btrim(pg_temp.note_plain(document), E' \t\n') = '' THEN
        RETURN NULL;
    END IF;
    RETURN document;
END
$$;

ALTER TABLE "game_download_resources" ALTER COLUMN "note" TYPE jsonb USING pg_temp.note_document("note"), ADD COLUMN "note_text" text NOT NULL DEFAULT '';

UPDATE "game_download_resources" SET "note_text" = pg_temp.note_plain("note") WHERE "note" IS NOT NULL;
