CREATE TEMPORARY TABLE "replaced_uploads" AS
WITH "latest" AS (
  SELECT DISTINCT ON (h."file_id") h."file_id", h."upload_session_id", h."reason"
  FROM "game_download_resource_file_histories" AS h
  ORDER BY h."file_id", h."created" DESC, h."id" DESC
)
SELECT l."file_id", s."file_name" AS "uploaded"
FROM "latest" AS l
JOIN "game_upload_sessions" AS s ON s."id" = l."upload_session_id"
WHERE s."file_name" <> '' AND (l."reason" IS NOT NULL OR EXISTS (SELECT 1 FROM "game_download_resource_file_histories" AS e WHERE e."file_id" = l."file_id" AND e."upload_session_id" IS DISTINCT FROM l."upload_session_id"));
UPDATE "game_download_resource_files" AS f
SET "file_name" = regexp_replace(f."file_name", '\.[A-Za-z0-9]{1,8}$', substring(u."uploaded" from '\.[A-Za-z0-9]{1,8}$'))
FROM "replaced_uploads" AS u
WHERE f."id" = u."file_id"
  AND f."file_name" ~ '\.[A-Za-z0-9]{1,8}$' AND u."uploaded" ~ '\.[A-Za-z0-9]{1,8}$'
  AND f."file_name" !~* '\.part[0-9]+\.rar$|\.([0-9]{3}|[rz][0-9]{2,3})$|\.tar\.[a-z0-9]{1,5}$'
  AND u."uploaded" !~* '\.part[0-9]+\.rar$|\.([0-9]{3}|[rz][0-9]{2,3})$|\.tar\.[a-z0-9]{1,5}$'
  AND lower(substring(f."file_name" from '\.[A-Za-z0-9]{1,8}$')) <> lower(substring(u."uploaded" from '\.[A-Za-z0-9]{1,8}$'))
  AND NOT EXISTS (SELECT 1 FROM "game_download_resource_files" AS o WHERE o."game_download_resource_id" = f."game_download_resource_id" AND o."id" <> f."id" AND o."file_name" = regexp_replace(f."file_name", '\.[A-Za-z0-9]{1,8}$', substring(u."uploaded" from '\.[A-Za-z0-9]{1,8}$')));
UPDATE "game_download_resource_files" AS f
SET "original_name" = u."uploaded"
FROM "replaced_uploads" AS u
WHERE f."id" = u."file_id" AND f."original_name" IS DISTINCT FROM u."uploaded";
DELETE FROM "game_download_resource_events" AS a
WHERE a."kind" = 'file_added' AND jsonb_array_length(a."data"->'files') = 1 AND EXISTS (
  SELECT 1 FROM "game_download_resource_events" AS b
  WHERE b."resource_id" = a."resource_id" AND b."kind" = 'file_replaced' AND b."created" <= a."created" AND b."created" > a."created" - interval '7 days'
    AND (b."data"->>'new_size')::bigint = (a."data"->'files'->0->>'size')::bigint
    AND NOT EXISTS (SELECT 1 FROM "game_download_resource_events" AS c WHERE c."resource_id" = a."resource_id" AND c."kind" IN ('file_added', 'file_replaced', 'file_removed') AND c."created" > b."created" AND c."created" < a."created")
);
DROP TABLE "replaced_uploads";
