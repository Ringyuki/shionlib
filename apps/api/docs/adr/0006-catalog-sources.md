# ADR 0006: Pluggable catalog sources with local materialization

## Context
Game, developer and character metadata were read at request time from Hikarinagi's internal API using a shared secret, and Hikarinagi pulled download data from Shionlib's partner API with the same secret. Lists, search and details failed whenever the internal API was unavailable. The public Hikarinagi Open API exposed details and search but no change feed.

## Decision
- Catalog metadata is stored in Shionlib's own tables (games, covers, images, tags, developers, characters, relations, links). Every read path uses local data.
- `internal/catalog` owns the sync rules. A `catalog.Source` port fetches game, developer and character snapshots and searches games. A source may also implement `catalog.ChangeFeed`. Snapshots are mapped to source-neutral records (`ToGameRecord`, `ToDeveloperRecord`, `ToCharacterRecord`) before they reach the store.
- `catalog_source_links (source, entity, external_id) → local_id` records which local row mirrors which source entry, together with `synced_at`, `revision`, `missing_at`, `failures` and `last_error`. `catalog_sync_cursors` keeps one change-feed cursor per source. Adding a source needs no schema change.
- The official adapter (`internal/adapter/hikarinagi`) uses the Hikarinagi Open API with an OAuth client-credentials token (`catalog:full catalog:sync`, `resource` parameter), a client-side rate limit and the `{success, data}` envelope. 404 maps to `catalog.ErrNotFound`, 429 to `catalog.ErrRateLimited`. Hikarinagi exposes `GET /api/v3/open/catalog/changes?since=&limit=` for the change feed and returns VNDB/Bangumi ids in `external_source`; both require the `catalog:sync` scope, which Shionlib's client requests together with `catalog:full`.
- Imports run as River jobs (`catalog_import`, queue `catalog`, unique by arguments while pending, five attempts). Rate limits snooze the job for a minute; entries gone at the source complete the job. `CATALOG_IMPORT_WORKERS` (default 2) sets the queue's concurrency and `HIKARINAGI_REQUESTS_PER_MINUTE` (default 55) the client-side budget; raise both together with the client's Open API throttle on Hikarinagi for a full backfill (a game takes five requests, a developer or character one).
- `catalog_changes` (every ten minutes) follows the change feed: game upserts are always imported, developer and character upserts only when they are already linked, deletions hide games, merges mark the old entry missing and import the target. The cursor advances only after a batch was applied.
- `catalog_refresh` (every ten minutes) queues a batch of links that were never synced or are older than `CATALOG_REFRESH_INTERVAL`.

## Applying a game
One transaction per entry:
1. Resolve the local row under a transaction-scoped advisory lock on the source key `(source, entity, external_id)`: existing link → row with the same `h_id` (Hikarinagi) → exactly one unlinked row with the same `v_id` or `b_id` → new row owned by `CATALOG_IMPORT_CREATOR_ID`. Developers and characters referenced by the game are resolved the same way, in external-id order, so concurrent imports never create duplicates or race for a link.

Local ids stay the primary keys: they are in public URLs and in every table that references games, developers and characters, an entry may be linked to more than one source or to none, and a source may merge entries; the source key is the natural key of the link.
2. Overwrite titles, intros, aliases, release, type, platforms, NSFW and staff. External ids are filled in only when the `(b_id, v_id)` pair is not used by another row.
3. Replace covers, images and links (with source provenance), tag relations (new tags inserted in name order; tag counts adjusted by this game's delta as the last statement, rows locked in id order), developer relations (developer-role credits only, as before), character relations and relations to games that are already linked.
4. Developers and characters referenced for the first time get a placeholder row and link; they are imported by their own jobs.

## Alternatives
Keep reading Hikarinagi at request time through the Open API (latency and availability coupled to another service, no local search); copy Hikarinagi's database (couples two schemas and needs internal access); scrape VNDB/Bangumi directly (duplicates Hikarinagi's curation).

## Migration
`20261003062800_backfill_hikarinagi_links` links every local row that carries an `h_id` and carries the legacy changes cursor over, so the worker continues where the legacy sync stopped. Rows without metadata are filled by `catalog_refresh`, which queues never-synced links first. The legacy internal client and `hikarinagi_sync_state` are removed in the same release.
## Consequences
Shionlib owns availability of its catalog. Imports and refreshes are background jobs bounded by the source's rate limit. The initial backfill follows the change feed from cursor 0 and fetches every referenced work once; running the worker against production before switching traffic pre-populates the tables the legacy backend ignores. The internal client, `hikarinagi_sync_state` (its cursor is carried into `catalog_sync_cursors`) and the partner API are removed.
