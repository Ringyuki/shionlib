UPDATE game_download_resources r
SET published_at = r.created
WHERE r.published_at IS NULL
  AND EXISTS (SELECT 1 FROM game_download_resource_files f WHERE f.game_download_resource_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM game_download_resource_files f WHERE f.game_download_resource_id = r.id AND f.file_status <> 3);
