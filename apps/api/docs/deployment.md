# Deployment

The API and the web client each ship as one container image and run together as a Dokploy compose project defined in `infra/compose.app.yml`.

## Image

`apps/api/Dockerfile` builds a static binary (`CGO_ENABLED=0`) and copies it into `debian:trixie-slim` with the runtime tools the API shells out to:

| Tool | Used by | Setting |
|---|---|---|
| `7zz` 25.01, the official static build from 7-zip.org (pinned by SHA-256; Debian's `7zip` package lacks `7zz` and RAR) | archive inspection before scans | `ARCHIVE_TOOL_PATH` |
| `pg_dump` (package `postgresql-client`) | database backups (`ENABLE_BACKUP=true`) | `DATABASE_BACKUP_PG_DUMP_PATH` |

The image runs as the unprivileged `shionlib` user. `/var/lib/shionlib/upload` and `/var/lib/shionlib/scan-logs` are the upload spool and scan log directories.

Subcommands: `serve` (HTTP; also runs jobs when `WORKERS_ENABLED=true`), `worker` (jobs only), `migrate up|status`, `health` (liveness probe against `127.0.0.1:$PORT/health/live`), `openapi [file]`.

`apps/web/Dockerfile` builds the web client into a `node:24` image that serves on port 3000 (see `apps/web/README.md`).

`.github/workflows/staging.yml` pushes `ghcr.io/<owner>/shionlib-api` and `ghcr.io/<owner>/shionlib-web` for `linux/amd64` on every push to `dev` (`sha-<short>`, `dev`) and deploys them to staging (see Staging below). `.github/workflows/api-image.yml` pushes the API image for `linux/amd64` and `linux/arm64` on `api-v<version>` tags (`<version>`).

## Compose services

| Service | Command | Notes |
|---|---|---|
| `migrate` | `migrate up` | runs once per deploy; applies SQL migrations (adopting a Prisma database on the first run) and River's tables |
| `api` | `serve` | `WORKERS_ENABLED=false`; serves HTTP on port 5000; starts after `migrate` succeeded |
| `worker` | `worker` | River workers and leader-elected scheduled tasks; starts after `migrate` and a healthy `clamav` |
| `web` | image default | the web client on port 3000; reaches the API at `http://api:5000` and starts after a healthy `api` |
| `clamav` | image default | `clamd` on `clamav:3310` with `infra/clamav/clamd.conf` mounted (4000M stream and scan limits), signatures in the `clamav-db` volume |
| `cap` | image default (`tiago2/cap`, pinned) | [Cap](https://github.com/tiagozip/cap) Standalone on `cap:3000`: issues the proof-of-work challenge a visitor solves before a download link and tells the API whether a token is good; its dashboard signs in with `CAP_ADMIN_KEY` |
| `cap-valkey` | `valkey-server` | Cap's own store (site keys, their secrets and settings, statistics) in the `cap-data` volume; losing it means creating a new site key |

`api` and `worker` share the `uploads` and `scan-logs` volumes: chunked uploads land on disk through `api` and are scanned and transferred to object storage by `worker`. Both must run on the same Docker host. Size the host disk for concurrent uploads (up to the `upload.max_file_size` setting each). `UPLOADS_VOLUME` puts the upload spool somewhere else than the `uploads` volume: set it to a host directory owned by uid `10001` (the image's `shionlib` user) to keep the spool on a disk of its own.

Postgres and Redis are external. Point `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` at them. An environment that has none of its own runs `infra/compose.data.yml` as a second compose project: Postgres 16 and Redis 7, published on `DATA_BIND_ADDRESS` only (the host's private address, never `0.0.0.0`), with `POSTGRES_PASSWORD` and `REDIS_PASSWORD` required and `POSTGRES_VOLUME`/`REDIS_VOLUME` to keep the data in a host directory.

## Environment

The compose file passes every variable the API reads through `${VAR}` substitution in the `x-api-environment` block. An empty or unset value means the binary's default (see `.env.example` and `internal/platform/config`). `devtool deploy check` (part of `verify.sh`) fails when the config and the compose block disagree; `devtool deploy env` prints the block for a new variable.

Values live in the Dokploy compose env field. Setting a variable there does nothing unless the compose file references it.

Required: `API_IMAGE`, `WEB_IMAGE`, `DATABASE_URL`, `TOKEN_SECRET` (16+ characters), `REFRESH_TOKEN_PEPPER`, and for the web client `IMAGE_BASE_URL`, `HIKARINAGI_SITE_URL`, `IMAGE_BUCKET_URL` and `IMAGE_PROCESSOR_URL` (the last two may be empty, which shows catalog pictures uncut; unset is refused so a deployment always states them). Production also needs at least `SITE_URL`, `REDIS_*`, `S3_FILE_*`, `S3_IMAGE_*`, `HIKARINAGI_CLIENT_ID`/`HIKARINAGI_CLIENT_SECRET` (an Open API client with `catalog:full catalog:sync`), `OIDC_CLIENT_SECRET`, `EMAIL_PROVIDER_API_KEY` and `EMAIL_SENDER_ADDRESS` (checked at startup when `APP_ENV=production`; `EMAIL_PROVIDER_ENDPOINT` defaults to Elastic Email's v2 send URL and is required for `postal`, where the server's base URL is enough and `/api/v1/send/message` is added), optionally `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` to export traces (see `observability.md`), `FILE_DOWNLOAD_TICKET_SECRET` when `FILE_DOWNLOAD_MODE=worker`, and Cap (below).

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

1. Create a compose project with source GitHub, repository `Ringyuki/shionlib`, the environment's branch (`dev` for staging, later `main` for production), compose path `infra/compose.app.yml`, automatic deploys off.
2. Fill the env field. `API_IMAGE`, `WEB_IMAGE` and `APP_VERSION` are managed by the deploy script.
3. Add three domains on the site's host: `/` for service `web`, port `3000`; `/api` for service `api`, port `5000`, prefix stripped; `/cap` for service `cap`, port `3000`, prefix stripped (see Cap above).
4. Configure the GitHub environment (`staging`, `production`) with secrets `DOKPLOY_URL`, `DOKPLOY_TOKEN` and `DOKPLOY_COMPOSE_ID`.

`infra/scripts/dokploy-deploy.sh` rewrites `API_IMAGE`, `WEB_IMAGE` and `APP_VERSION` in the compose env through `compose.update`, triggers `compose.deploy` and waits for Dokploy to report the deployment done or failed. `.github/workflows/staging.yml` runs it after building both images; `.github/workflows/deploy.yml` (manual) runs it for a tag that already exists, on staging or production. Dokploy's API needs `accept: application/json` on mutations. Compose changes are read from git at deploy time, so commit and push them first.

## Staging

`https://staging.shionlib.com` runs on the staging host as the Dokploy project `shionlib`, environment `staging`, with two compose projects from branch `dev`: `data` (`infra/compose.data.yml`) and `app` (`infra/compose.app.yml`). It follows the staging instance of Hikarinagi for the catalog (`HIKARINAGI_API_BASE_URL`, `HIKARINAGI_TOKEN_URL`) and runs with `APP_ENV=staging`.

- **Deploys.** Work happens on `major/shionlib-next`; pushing that branch to `dev` (`git push origin major/shionlib-next:dev`) builds both images and deploys them. A push that changes nothing under `apps/api`, `apps/web` or `infra`, or only Markdown files, deploys nothing.
- **Disk.** The host has a 512G data disk as the LVM volume group `shionlib`: `uploads` (400G, `/srv/shionlib/uploads`, the spool in `spool/`) and `postgres` (40G, `/srv/shionlib/postgres`, the cluster in `data/`); the rest is unallocated for growing either (`lvextend -r`). The mount points are immutable while unmounted, so a missing disk stops the containers instead of filling the system disk. `UPLOADS_VOLUME` and `POSTGRES_VOLUME` point the composes at those directories.
- **Ingress.** Public traffic reaches the host through the gateway's nginx, which forwards `staging.shionlib.com` to the host's Traefik over HTTPS; Dokploy's three domains route by path from there. Traefik must trust the gateway (`forwardedHeaders.trustedIPs` on its entry points), or every visitor arrives with the gateway's address and shares one rate limit. The web server in turn takes the scheme and host from the headers Traefik forwards (`apps/web/server.js`); without them it refuses every submission as cross-site.
- **Search engines.** A Cloudflare response header rule on the zone (`http_response_headers_transform`, rule `staging_noindex`) adds `X-Robots-Tag: noindex, nofollow` to everything the staging host answers.
- **Downloads.** Staging issues worker links (`FILE_DOWNLOAD_MODE=worker`) to its own download worker, `shionlib-download-worker-staging` at `https://dl-staging.hikarifallback.uk` (`env.staging` in `apps/download-worker/wrangler.jsonc`). The worker's `TICKET_SECRET` and the API's `FILE_DOWNLOAD_TICKET_SECRET` hold the same value; files live in the B2 bucket `shionlib-test`. `.github/workflows/staging-download-worker.yml` deploys it on a push to `dev` that changes `apps/download-worker`; by hand it is `npx wrangler deploy --env staging` in that directory, and the secret is set with `npx wrangler secret put TICKET_SECRET --env staging`.
- **Verification.** The Cap site key was created with `docker/scripts/cap-site-key.sh https://staging.shionlib.com/cap <admin key>`, so it refuses automated browsers like production will.

## Cutover from the NestJS backend

1. Register a Hikarinagi Open API client for Shionlib and deploy the Hikarinagi change feed (`GET /api/v3/open/catalog/changes`).
2. Take a database backup.
3. Stop the legacy backend (pm2 `shionlib-backend`); the frontend can show a maintenance page.
4. Deploy the compose. `migrate` adopts the Prisma history, renames legacy enum types and columns, creates the catalog link tables, links rows that carry `h_id`, carries the Hikarinagi cursor over, builds the search indexes and converts the content of comments and walkthroughs from the legacy editor's state to rich text documents (ADR 0013), keeping every original in `legacy_editor_contents`.
5. Copy Redis state that changed keys (see "Redis" in `migration.md`): the recent-update sorted set and the Bangumi tokens.
6. Let `worker` follow the change feed from the carried cursor and refresh linked entries (`catalog_refresh` queues the never-synced links first). Watch `catalog_source_links.failures`.
7. Switch traffic to `api` and smoke-test login, game pages, downloads (they need Cap, see above), uploads and search.

Rollback before step 7: stop the compose and start the legacy backend; the forward migrations are additive except for the enum/column renames, the `hikarinagi_sync_state` replacement and the conversion of editor content (its down migration puts the kept `content` and `html` back), which have down migrations (`shionlib-api migrate` has no `down` subcommand; run golang-migrate manually if needed).
