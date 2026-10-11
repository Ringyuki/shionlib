INSERT INTO game_download_resource_events (resource_id, kind, actor_id, data, created)
SELECT r.id,
       'published',
       r.creator_id,
       jsonb_build_object('files', COALESCE((
           SELECT jsonb_agg(jsonb_build_object('name', f.file_name, 'size', COALESCE(first.file_size, f.file_size)) ORDER BY f.id)
           FROM game_download_resource_files f
           LEFT JOIN LATERAL (
               SELECT h.file_size
               FROM game_download_resource_file_histories h
               WHERE h.file_id = f.id
               ORDER BY h.created, h.id
               LIMIT 1
           ) first ON TRUE
           WHERE f.game_download_resource_id = r.id
       ), '[]'::jsonb)),
       r.published_at
FROM game_download_resources r
WHERE r.published_at IS NOT NULL;

INSERT INTO game_download_resource_events (resource_id, kind, actor_id, data, created)
SELECT f.game_download_resource_id,
       'file_replaced',
       h.operator_id,
       jsonb_strip_nulls(jsonb_build_object('name', f.file_name, 'reason', NULLIF(h.reason, ''), 'old_size', h.previous_size, 'new_size', h.file_size)),
       h.created
FROM (
    SELECT h.file_id,
           h.operator_id,
           h.reason,
           h.file_size,
           h.created,
           LAG(h.file_size) OVER (PARTITION BY h.file_id ORDER BY h.created, h.id) AS previous_size,
           ROW_NUMBER() OVER (PARTITION BY h.file_id ORDER BY h.created, h.id) AS position
    FROM game_download_resource_file_histories h
) h
JOIN game_download_resource_files f ON f.id = h.file_id
WHERE h.position > 1;
