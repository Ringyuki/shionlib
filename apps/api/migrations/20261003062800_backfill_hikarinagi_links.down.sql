CREATE TABLE IF NOT EXISTS hikarinagi_sync_state (
    id integer DEFAULT 1 NOT NULL PRIMARY KEY,
    last_event_id bigint DEFAULT 0 NOT NULL,
    synced_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DELETE FROM catalog_source_links WHERE source = 'hikarinagi' AND synced_at IS NULL;
