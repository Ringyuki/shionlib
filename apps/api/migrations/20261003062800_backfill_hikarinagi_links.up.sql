INSERT INTO catalog_source_links (source, entity, external_id, local_id, created, updated)
SELECT 'hikarinagi', 'game', h_id::text, id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM games WHERE h_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO catalog_source_links (source, entity, external_id, local_id, created, updated)
SELECT 'hikarinagi', 'developer', h_id::text, id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM game_developers WHERE h_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO catalog_source_links (source, entity, external_id, local_id, created, updated)
SELECT 'hikarinagi', 'character', h_id::text, id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM game_characters WHERE h_id IS NOT NULL
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF to_regclass('public.hikarinagi_sync_state') IS NOT NULL THEN
        INSERT INTO catalog_sync_cursors (source, cursor, created, updated)
        SELECT 'hikarinagi', last_event_id::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM hikarinagi_sync_state
        WHERE id = 1 AND last_event_id > 0
        ON CONFLICT (source) DO NOTHING;
    END IF;
END $$;

DROP TABLE IF EXISTS hikarinagi_sync_state;
