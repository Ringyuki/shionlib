# Deployment

The API ships as one container image and runs as a Dokploy compose project defined in `infra/compose.app.yml`.

## Image

`apps/api/Dockerfile` builds a static binary (`CGO_ENABLED=0`) and copies it into `debian:trixie-slim` with the runtime tools the API shells out to:

| Tool | Used by | Setting |
|---|---|---|
| `7zz` 25.01, the official static build from 7-zip.org (pinned by SHA-256; Debian's `7zip` package lacks `7zz` and RAR) | archive inspection before scans | `ARCHIVE_TOOL_PATH` |
| `pg_dump` (package `postgresql-client`) | database backups (`ENABLE_BACKUP=true`) | `DATABASE_BACKUP_PG_DUMP_PATH` |

The image runs as the unprivileged `shionlib` user. `/var/lib/shionlib/upload` and `/var/lib/shionlib/scan-logs` are the upload spool and scan log directories.

Subcommands: `serve` (HTTP; also runs jobs when `WORKERS_ENABLED=true`), `worker` (jobs only), `migrate up|status`, `health` (liveness probe against `127.0.0.1:$PORT/health/live`), `openapi [file]`.

`.github/workflows/api-image.yml` pushes `ghcr.io/<owner>/shionlib-api` for `linux/amd64` and `linux/arm64` on every push to `major/shionlib-next` (`sha-<short>`, `major-shionlib-next`) and on `api-v<version>` tags (`<version>`).

## Compose services

| Service | Command | Notes |
|---|---|---|
| `migrate` | `migrate up` | runs once per deploy; applies SQL migrations (adopting a Prisma database on the first run) and River's tables |
| `api` | `serve` | `WORKERS_ENABLED=false`; serves HTTP on port 5000; starts after `migrate` succeeded |
| `worker` | `worker` | River workers and leader-elected scheduled tasks; starts after `migrate` and a healthy `clamav` |
| `clamav` | image default | `clamd` on `clamav:3310` with `infra/clamav/clamd.conf` mounted (4000M stream and scan limits), signatures in the `clamav-db` volume |
| `cap` | image default (`tiago2/cap`, pinned) | [Cap](https://github.com/tiagozip/cap) Standalone on `cap:3000`: issues the proof-of-work challenge a visitor solves before a download link and tells the API whether a token is good; its dashboard signs in with `CAP_ADMIN_KEY` |
| `cap-valkey` | `valkey-server` | Cap's own store (site keys, their secrets and settings, statistics) in the `cap-data` volume; losing it means creating a new site key |

`api` and `worker` share the `uploads` and `scan-logs` volumes: chunked uploads land on disk through `api` and are scanned and transferred to object storage by `worker`. Both must run on the same Docker host. Size the host disk for concurrent uploads (up to the `upload.max_file_size` setting each).

Postgres and Redis are external. Point `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` at them.

## Environment

The compose file passes every variable the API reads through `${VAR}` substitution in the `x-api-environment` block. An empty or unset value means the binary's default (see `.env.example` and `internal/platform/config`). `devtool deploy check` (part of `verify.sh`) fails when the config and the compose block disagree; `devtool deploy env` prints the block for a new variable.

Values live in the Dokploy compose env field. Setting a variable there does nothing unless the compose file references it.

Required: `API_IMAGE`, `DATABASE_URL`, `TOKEN_SECRET` (16+ characters), `REFRESH_TOKEN_PEPPER`. Production also needs at least `SITE_URL`, `REDIS_*`, `S3_FILE_*`, `S3_IMAGE_*`, `HIKARINAGI_CLIENT_ID`/`HIKARINAGI_CLIENT_SECRET` (an Open API client with `catalog:full catalog:sync`), `OIDC_CLIENT_SECRET`, `EMAIL_PROVIDER_API_KEY` and `EMAIL_SENDER_ADDRESS` (checked at startup when `APP_ENV=production`; `EMAIL_PROVIDER_ENDPOINT` defaults to Elastic Email's v2 send URL and is required for `postal`, where the server's base URL is enough and `/api/v1/send/message` is added), optionally `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` to export traces (see `observability.md`), `FILE_DOWNLOAD_TICKET_SECRET` when `FILE_DOWNLOAD_MODE=worker`, and Cap (below).

## Cap

A download link is issued only for a token from Cap, so production refuses to start without `CAP_URL`, `CAP_SITE_KEY` and `CAP_SECRET`.

1. Set `CAP_ADMIN_KEY` (32 or more characters) in the compose env and deploy; the `cap` service starts with it.
2. Route `/cap/*` on the site's own domain to service `cap`, port `3000`, with the prefix stripped, the way `/api/*` reaches the API. Cap needs no domain of its own: the visitor's browser asks for the challenge at `/cap/<site key>/challenge` and returns the solution at `/cap/<site key>/redeem`, and the dashboard answers at `/cap/` (it builds its addresses from where it is served).
   - This makes the dashboard's sign-in page public, guarded by the admin key alone, as a domain of its own would. To keep it private, route only those two addresses and create the site key from inside the network with the script below.
   - Cap limits requests per client address and takes it from `X-Forwarded-For`, `X-Real-IP` or `CF-Connecting-IP`. Behind a proxy that sends none of them, name its header in `CAP_RATELIMIT_IP_HEADER`, or every visitor shares one limit.
   - `CAP_CORS_ORIGIN` matters only when Cap is served from another origin than the site.
3. Open `https://<site domain>/cap/`, sign in with the admin key and create a site key. Keep instrumentation on and turn on 「Attempt to block headless browsers」 in the key's configuration: with it Cap refuses the browsers that automation drives (Playwright, Puppeteer, Selenium and the usual ways of hiding them), which otherwise pass like anyone else. Note the site key and its secret.
4. Set `CAP_URL=http://cap:3000`, `CAP_SITE_KEY` and `CAP_SECRET` for the API, and `CAP_ENDPOINT=/cap/<site key>/` for the web client, then deploy again.

`docker/scripts/cap-site-key.sh <cap url> <admin key> [name]` creates a site key without the dashboard, with instrumentation and the block on automated browsers both on, and prints the two API variables; local setups use it, and the e2e stack turns both off (`CAP_INSTRUMENTATION=false CAP_BLOCK_AUTOMATED=false`) because its browser is automated.

Cap is one layer, not the whole defence: it keeps plain scripts out and makes every link cost a second or two of CPU, but a real browser driven with enough care still passes. What bounds the volume is the API's own limit on links per address (`throttle.download_limit` per `throttle.download_window`, then `throttle.download_block`, all in the config center) and the lifetime and connection cap of each link.

## Dokploy setup

1. Create a compose project with source GitHub, repository `Ringyuki/shionlib`, branch `major/shionlib-next` (later `main`), compose path `infra/compose.app.yml`.
2. Fill the env field. `API_IMAGE` and `APP_VERSION` are managed by the deploy workflow.
3. Add the domain for service `api`, port `5000`, and the path `/cap` of the site's domain for service `cap`, port `3000`, prefix stripped (see Cap above).
4. Configure the GitHub environments `staging` and `production` with secrets `DOKPLOY_URL`, `DOKPLOY_TOKEN` and `DOKPLOY_API_COMPOSE_ID`.

`.github/workflows/deploy-api.yml` (manual) rewrites `API_IMAGE`/`APP_VERSION` in the compose env through `compose.update` and triggers `compose.deploy`. Dokploy's API needs `accept: application/json` on mutations. Compose changes are read from git at deploy time, so commit and push them first.

## Cutover from the NestJS backend

1. Register a Hikarinagi Open API client for Shionlib and deploy the Hikarinagi change feed (`GET /api/v3/open/catalog/changes`).
2. Take a database backup.
3. Stop the legacy backend (pm2 `shionlib-backend`); the frontend can show a maintenance page.
4. Deploy the compose. `migrate` adopts the Prisma history, renames legacy enum types and columns, creates the catalog link tables, links rows that carry `h_id`, carries the Hikarinagi cursor over, builds the search indexes and converts the content of comments and walkthroughs from the legacy editor's state to rich text documents (ADR 0013), keeping every original in `legacy_editor_contents`.
5. Copy Redis state that changed keys (see "Redis" in `migration.md`): the recent-update sorted set and the Bangumi tokens.
6. Let `worker` follow the change feed from the carried cursor and refresh linked entries (`catalog_refresh` queues the never-synced links first). Watch `catalog_source_links.failures`.
7. Switch traffic to `api` and smoke-test login, game pages, downloads (they need Cap, see above), uploads and search.

Rollback before step 7: stop the compose and start the legacy backend; the forward migrations are additive except for the enum/column renames, the `hikarinagi_sync_state` replacement and the conversion of editor content (its down migration puts the kept `content` and `html` back), which have down migrations (`shionlib-api migrate` has no `down` subcommand; run golang-migrate manually if needed).
