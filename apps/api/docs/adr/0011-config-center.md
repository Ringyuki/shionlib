# ADR 0011: A config center for tunable values

## Context
About sixty values that operators adjust (rate limits, upload sizes and quotas, scan review rules, download link lifetimes, hot score weights, catalog sync batches, AI log retention, the register and sponsor switches) were environment variables. Bootstrap copied them into `Options` and `Policy` structs once, so every change needed a redeploy, there was no record of who changed what, and the admin panel could not offer them. The upload rewrite adds more of them (quota tiers, in-flight limits, spool reserve) that must be adjustable at any time.

## Decision
Add the capability `internal/setting`:

- A package declares each tunable value in its `settings.go` as a typed key: `setting.Int`, `Bytes`, `Float`, `Duration` (whole seconds), `Flag` or `Text`, with a `group.name` in snake case, a Chinese label for the admin panel, an optional description, a default and bounds (or a maximum length). Declarations register in a process-wide catalog like `apperror.Define`; a bad or duplicate declaration panics at startup.
- Code reads a value where it is used with `Key.Read(source)`. `setting.Source` is the single read interface; `*setting.Service` implements it with an in-memory snapshot, and `settingtest.Source` replaces it in tests. A missing, undeclared or out-of-bounds stored value falls back to the default.
- Overrides live in `settings` (one JSON value per name); every change and reset is recorded in `setting_changes` with the previous value, the new value, the editor and the time. Saving asks for nothing else.
- Each process loads the snapshot before it starts serving, then `platform/refresh.Watcher` reloads it when another process announces a change over Redis pub/sub and once a minute as a fallback. A failed announcement or reload is logged and the previous snapshot stays in use.
- Admins list settings and their history at `GET /admin/settings` and `GET /admin/settings/{name}/history`; super admins change them with `PATCH /admin/settings/{name}` and restore defaults with `DELETE /admin/settings/{name}`. `GET /settings/public` returns the few values the web client needs.
- Values stay in the environment when a process needs them before it starts or they belong to the deployment: addresses, ports, secrets, credentials, buckets, paths, connection pools, client timeouts, logging, tracing and worker placement. `archtest` lists every remaining numeric, duration and boolean variable with that reason and fails on new ones.

## Alternatives
Keep environment variables (redeploys, no audit, no admin panel); a generic key-value table without typed declarations (no bounds, no labels, typos fail silently); an external config service such as Consul (another service to run for a handful of values); reading the database on every use (a query per request for the rate limiter).

## Consequences
New tables `settings` and `setting_changes`. A changed value reaches every process within a moment, at most a minute if Redis pub/sub is down. Throttle policies are read per request, so the limit headers change as soon as a setting does. The settings of the old upload quota model (`upload.quota_*`) were replaced by the upload tiers of ADR 0012.

## Migration
These environment variables are removed and become settings with the same defaults: `ALLOW_REGISTER` (`user.allow_register`), `THROTTLE_*` (`throttle.*`, plus `throttle.search_*` and `throttle.upload_chunk_*` that were constants), `UPLOAD_LARGE_FILE_*`, `FILE_UPLOAD_CHUNK_SIZE` and `FILE_UPLOAD_SESSION_EXPIRES_IN` (`upload.*`; ADR 0012 raises `upload.max_file_size` from 20 GiB to 30 GiB), `FILE_SCAN_MALWARE_*` (`scan.*`), `FILE_DOWNLOAD_MAX_CONNS`, `FILE_DOWNLOAD_EXPIRES_IN`, `FILE_DOWNLOAD_ESTIMATED_SPEED` and `FILE_DOWNLOAD_MAX_EXPIRES_IN` (`download.*`), `CATALOG_REFRESH_INTERVAL`, `CATALOG_REFRESH_BATCH` and `CATALOG_CHANGES_BATCH` (`catalog.*`), `GAME_HOT_SCORE_*` (`hot_score.*`), `AI_RECORD_PAYLOADS`, `AI_REQUEST_RETENTION_DAYS` and `AI_PAYLOAD_RETENTION_DAYS` (`ai.*`) and `SPONSOR_ENABLED` (`sponsor.enabled`). `UPLOAD_SMALL_FILE_MAX_SIZE` was never read and is dropped; `UPLOAD_QUOTA_*` are dropped with the old quota model (ADR 0012). A deployment that set any of them to a non-default value sets the matching setting once after deploying.
