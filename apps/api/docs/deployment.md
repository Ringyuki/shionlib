# Deployment

The API ships as one container image and runs as a Dokploy compose project defined in `infra/compose.app.yml`.

## Image

`apps/api/Dockerfile` builds a static binary (`CGO_ENABLED=0`) and copies it into `debian:trixie-slim` with the runtime tools the API shells out to:

| Tool | Used by | Setting |
|---|---|---|
| `7zz` 25.01, the official static build from 7-zip.org (pinned by SHA-256; Debian's `7zip` package lacks `7zz` and RAR) | archive inspection before scans | `ARCHIVE_TOOL_PATH` |
| `pg_dump` (package `postgresql-client`) | database backups (`ENABLE_BACKUP=true`) | `DATABASE_BACKUP_PG_DUMP_PATH` |

The image runs as the unprivileged `shionlib` user. `/var/lib/shionlib/upload` and `/var/lib/shionlib/scan-logs` are the upload spool and scan log directories.

Subcommands: `serve` (HTTP; also runs jobs when `WORKERS_ENABLED=true`), `worker` (jobs only), `migrate up|status`, `health` (liveness probe against `127.0.0.1:$PORT/health/live`), `search reindex` (rebuilds the Meilisearch index when `SEARCH_ENGINE=meilisearch`), `openapi [file]`.

`.github/workflows/api-image.yml` pushes `ghcr.io/<owner>/shionlib-api` for `linux/amd64` and `linux/arm64` on every push to `major/shionlib-next` (`sha-<short>`, `major-shionlib-next`) and on `api-v<version>` tags (`<version>`).

## Compose services

| Service | Command | Notes |
|---|---|---|
| `migrate` | `migrate up` | runs once per deploy; applies SQL migrations (adopting a Prisma database on the first run) and River's tables |
| `api` | `serve` | `WORKERS_ENABLED=false`; serves HTTP on port 5000; starts after `migrate` succeeded |
| `worker` | `worker` | River workers and leader-elected scheduled tasks; starts after `migrate` and a healthy `clamav` |
| `clamav` | image default | `clamd` on `clamav:3310`, signatures in the `clamav-db` volume |

`api` and `worker` share the `uploads` and `scan-logs` volumes: chunked uploads land on disk through `api` and are scanned and transferred to object storage by `worker`. Both must run on the same Docker host. Size the host disk for concurrent uploads (up to `UPLOAD_LARGE_FILE_MAX_SIZE` each).

Postgres and Redis are external. Point `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` at them.

## Environment

The compose file passes every variable the API reads through `${VAR}` substitution in the `x-api-environment` block. An empty or unset value means the binary's default (see `.env.example` and `internal/platform/config`). `devtool deploy check` (part of `verify.sh`) fails when the config and the compose block disagree; `devtool deploy env` prints the block for a new variable.

Values live in the Dokploy compose env field. Setting a variable there does nothing unless the compose file references it.

Required: `API_IMAGE`, `DATABASE_URL`, `TOKEN_SECRET` (16+ characters), `REFRESH_TOKEN_PEPPER`, `AI_KEY_SECRET` (32+ characters; seals AI provider keys, so changing it requires re-entering them). Production also needs at least `SITE_URL`, `REDIS_*`, `S3_FILE_*`, `S3_IMAGE_*`, `HIKARINAGI_CLIENT_ID`/`HIKARINAGI_CLIENT_SECRET` (an Open API client with `catalog:full catalog:sync`), `OIDC_CLIENT_SECRET`, `EMAIL_PROVIDER_*`, `APM_ENDPOINT`/`APM_INGEST_KEY` for traces (see `observability.md`), and `FILE_DOWNLOAD_TICKET_SECRET` when `FILE_DOWNLOAD_MODE=worker`.

## Dokploy setup

1. Create a compose project with source GitHub, repository `Ringyuki/shionlib`, branch `major/shionlib-next` (later `main`), compose path `infra/compose.app.yml`.
2. Fill the env field. `API_IMAGE` and `APP_VERSION` are managed by the deploy workflow.
3. Add the domain for service `api`, port `5000`.
4. Configure the GitHub environments `staging` and `production` with secrets `DOKPLOY_URL`, `DOKPLOY_TOKEN` and `DOKPLOY_API_COMPOSE_ID`.

`.github/workflows/deploy-api.yml` (manual) rewrites `API_IMAGE`/`APP_VERSION` in the compose env through `compose.update` and triggers `compose.deploy`. Dokploy's API needs `accept: application/json` on mutations. Compose changes are read from git at deploy time, so commit and push them first.

## Cutover from the NestJS backend

1. Register a Hikarinagi Open API client for Shionlib and deploy the Hikarinagi change feed (`GET /api/v3/open/catalog/changes`).
2. Take a database backup.
3. Stop the legacy backend (pm2 `shionlib-backend`); the frontend can show a maintenance page.
4. Deploy the compose. `migrate` adopts the Prisma history, renames legacy enum types and columns, creates the catalog link tables, links rows that carry `h_id`, carries the Hikarinagi cursor over and builds the search indexes.
5. Copy Redis state that changed keys (see "Redis" in `migration.md`): the recent-update sorted set and the Bangumi tokens.
6. Let `worker` follow the change feed from the carried cursor and refresh linked entries (`catalog_refresh` queues the never-synced links first). Watch `catalog_source_links.failures`.
7. Switch traffic to `api` and smoke-test login, game pages, downloads, uploads and search.

Rollback before step 7: stop the compose and start the legacy backend; the forward migrations are additive except for the enum/column renames and the `hikarinagi_sync_state` replacement, which have down migrations (`shionlib-api migrate` has no `down` subcommand; run golang-migrate manually if needed).
