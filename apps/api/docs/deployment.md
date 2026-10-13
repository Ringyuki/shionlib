# Deployment

The API and the web client each ship as one container image and run together as a Dokploy compose project defined in `infra/compose.app.yml`.

## Image

`apps/api/Dockerfile` builds a static binary (`CGO_ENABLED=0`) and copies it into `debian:trixie-slim` with the runtime tools the API shells out to:

| Tool | Used by | Setting |
|---|---|---|
| `7zz` from 7-Zip ZS 26.02 (v1.5.7 R2), the Linux build of the [7-Zip-zstd](https://github.com/mcmilk/7-Zip-zstd) releases, installed by `scripts/install-7zip.sh` (release and SHA-256 pinned there; CI installs the same build). It is 7-Zip with the Zstandard, Brotli, LZ4, LZ5, Lizard and Fast LZMA2 codecs, which a sixth of the catalogue's 7z archives need; the official build and Debian's `7zip` package cannot unpack them | archive inspection before scans | `ARCHIVE_TOOL_PATH` |
| `pg_dump` (package `postgresql-client`) | database backups (`ENABLE_BACKUP=true`) | `DATABASE_BACKUP_PG_DUMP_PATH` |

The image runs as the unprivileged `shionlib` user. `/var/lib/shionlib/upload` and `/var/lib/shionlib/scan-logs` are the upload spool and scan log directories.

Subcommands: `serve` (HTTP; also runs jobs when `WORKERS_ENABLED=true`), `worker` (jobs only), `migrate up|status`, `health` (liveness probe against `127.0.0.1:$PORT/health/live`), `openapi [file]`, `recheck [file id ...]` (see Checks that keep failing).

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

Postgres and Redis are external. Point `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` at them. Production runs PostgreSQL 17, and so do CI, the e2e stack and staging: the image's `pg_dump` is version 17 and cannot back up a newer server, and a version 16 `pg_restore` cannot read the backups it writes. An environment that has none of its own runs `infra/compose.data.yml` as a second compose project: Postgres 17 and Redis 7, published on `DATA_BIND_ADDRESS` only (the host's private address, never `0.0.0.0`), with `POSTGRES_PASSWORD` and `REDIS_PASSWORD` required and `POSTGRES_VOLUME`/`REDIS_VOLUME` to keep the data in a host directory.

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

## Resources published before

Resources published before the rewrite said their translation, translators, edition and form in their note and file names, and their files have no inspection (ADR 0014). The worker completes them by itself (ADR 0017); nothing is run by hand, and both tasks can run on a live site.

### Description (`resource_description`, every ten minutes)

The migration `20261013165200_backfill_undescribed_resources` marks every resource that exists when it runs as `undescribed`; a resource created later is described by its uploader and never carries the mark. The task reads each marked resource once, writes what it can tell and clears the mark, so it finishes in its first run (seconds for the whole catalogue) and finds nothing afterwards.

- A resource in Japanese only gets the translation `none`. For the others the note is read first: an official translation (`官方中文`, `Official English Version`), a machine translation (`机翻`) or the names of translators (`绿茶汉化组×熊喵守护协会`); when the note says nothing, a trailing bracket of the file name (`[官方中文]`, `[守夜人汉化组]`) is. A note that mixes them, or that cannot be told from a remark, is left alone and the translation stays unset for the uploader to fill in.
- A note that was only the translation is cleared, and a single address in it becomes the release page; a note that says more is kept as it is.
- The edition comes from the file name (`DL版`, `パッケージ版`, `Steam版`), and the form becomes `disc` when the file name names a disc image format (`(iso+mds+rr3)`) or an inspection found one. `(files)` only says that there is no disc image, so the form of such a resource is read from its inspection (below).
- A file name is read segment by segment: an optional release date that equals the game's, a brand that is the game's first developer or one of its aliases, the game's titles, an edition (`DL版`, `初回版`, any other `…版` becomes the edition name), a bracket naming the translation or a patch version, and a medium in brackets (`files`, disc formats, a recovery record). When every segment is read the resource takes canonical names: the old name is kept as `original_name` and the file is renamed. Any other name stays as it is with canonical names off.
- Only what a resource does not say yet is written, its update time is kept and no history event is recorded. Names that are new create translators; the ones that differ only in writing show up under 疑似重复 in the admin panel. A resource that fails is named in the task's error and tried again by the next run.

### Inspection (`stored_file_inspection`, every minute)

The task takes the resources with stored files that have no inspection, most downloaded first, fetches each file (or every volume of a set) from the bucket into the scan workspace, runs the steps of a check (test, listing, nested archives and disc images, scan, previews) and attaches the result. It needs what a check needs (`FILE_SCAN_ENABLED=true`, `7zz`, clamd, the spool, the bucket credentials) and does nothing without checks.

- **How many at once** is the setting `scan.backfill_workers` (admin panel, group 「检查」: 2 by default, at most 8, 0 pauses). It is read again before every resource and every 30 seconds while all workers are busy, so a change applies at once; a pause lets the running ones finish. Each worker needs room on the spool for its file and what is extracted from it, and runs a 7-Zip test that uses every core, so more workers than cores gain nothing (three run well on the 4-core staging host). Uploads are checked by their own task at the same time and share clamd.
- **Downloads** go in 64 MiB ranges sixteen at a time; a 9 GB archive on staging took 20 seconds to fetch and a minute and a half to test, list and scan. The whole catalogue is the size of the bucket.
- **A run** lasts until nothing is left or for two hours, and takes no resource in its last 15 minutes; the next run starts within a minute. A stop or a deploy interrupts the running ones, which are taken again later.
- **Outcomes.** A clean file gains its inspection and nothing else changes. An archive that can no longer be opened gets an inspection that says so and stays published. A detection puts the file under review like an upload and hides the resource until an admin decides; unlike an upload, a published file is never removed when the review deadline passes. A resource whose file the bucket does not hold gets nothing and is looked for again a day later; every run names those resources in its error (`the bucket holds no object for files of N resources`). Any other failure is retried an hour later and named in the error.
- **Form.** After the inspection the form of a resource that has none is read from what the archive holds: a disc image makes it `disc`; an uninstaller (`unins000.exe`, `uninst.exe`, `Uninstall.exe`, `Unwise.exe`) means a folder copied after installing, `portable`; an installer program with most of the bytes in itself or in its data (`setup-1.bin` beside `setup.exe`, `.cab`, `.msi`, `.hdr`) is `installer`; any other program that is not an installer, an updater, a configuration tool or a runtime makes it `portable`; an installer program alone is `installer`. Programs under `DirectX`, `Redist`, `Runtime`, `Support` and similar folders are left out, and an archive whose bytes are mostly in nested archives that could not be opened, or one without programs (data for an emulator, disk images of old computers), keeps no form. A published resource records the change in its history (`form_read`). A form an uploader chose is never changed, except to `disc` when a disc image is found. On the 2,238 zip and 7z archives without a form in production (2026-10) this gives 2,041 `portable`, 7 `installer`, 114 `disc` and 21 without a form; 46 more are mostly nested archives and are decided once these are opened.

## Composing translated editions

Composition (ADR 0016) runs in the worker, on the queue `composition`, with 7-Zip and clamd like a check. It needs `FILE_SCAN_ENABLED=true`: the result is checked like an upload, and without checks the API refuses to begin one (`COMPOSITION_CHECKS_OFF`).

- **Disk.** Everything happens on the upload spool, under `<spool>/.compose/<id>/`. One composition needs about the base twice (fetched and unpacked), the patch and saved games unpacked and the result; the run refuses to start (`no_room`) when the spool has less free space than that. Saved games stay there for as long as their resource exists, so a later patch is composed without them being uploaded again. `composition_clean` (every ten minutes) removes drafts nobody touched for `composition.draft_ttl` and directories that belong to no composition.
- **Settings** (admin panel, group 「合成」, applied at once): `composition.max_unpacked_size` (a larger base cannot be used, 40 GiB), `composition.concurrency` (how many run at once, 1; at most 4), `composition.queue_limit` (how many may wait, 20), `composition.pack_threads` (7-Zip threads for unpacking and packing, 4) and `composition.draft_ttl` (24 hours). Raise the concurrency only with room on the spool for that many at once.
- **Bases.** A resource can be a base only when its file has an inspection and its form is `portable`; resources published before get both from the worker (Resources published before, above).
- A composition that fails for a reason that will not go away by itself (the base is gone, an archive cannot be unpacked, a harmful result, no room) is marked failed with its reason and the uploader is told; one that fails otherwise is tried again by River up to five times and then marked failed as `internal` with the error in `failure_detail`.

## Checks that keep failing

The check of an upload can fail for a reason that has nothing to do with the file (clamd or the database is down, the spool is full) or for one that will never go away (the archive cannot be unpacked here, a defect in the check). The two cannot be told apart reliably, so a failing check is neither repeated for ever nor does it cost the uploader the file by itself:

- After a failure the resource waits before its next try: 30 minutes, then twice as long each time, at most 8 hours. The failure count and the last error are kept on the file (`check_failures`, `check_error`).
- After `scan.check_attempts` failures in a row (6, about 16 hours) the check stalls. The uploader sees 「检查未完成」 and gets a message; every admin gets a message and an email with the file, the uploader and the last error. Nothing is tried again by itself.
- Once the cause is fixed, put the stalled checks back in the queue from the worker container. The next run of the check takes them, with their count at zero:

```bash
docker exec <worker container> shionlib-api recheck          # every stalled check
docker exec <worker container> shionlib-api recheck 8817 8819  # the checks of these files
```

- An admin can remove the resource at any time; its uploader can remove the file only while the resource holds another one (the last file of a resource cannot be removed). A stalled check nobody resumed within `scan.stalled_check_timeout` (7 days) is given up: the file is rejected, its uploader is told and the file is removed with the other rejected files.
- A check cut short because the worker stops (a deploy) is not counted. One that is still running when the run of the task ends (one hour for everything waiting) is.

## Cutover from the NestJS backend

1. Register a Hikarinagi Open API client for Shionlib and deploy the Hikarinagi change feed (`GET /api/v3/open/catalog/changes`).
2. Take a database backup.
3. Stop the legacy backend (pm2 `shionlib-backend`); the frontend can show a maintenance page.
4. Deploy the compose. `migrate` adopts the Prisma history, renames legacy enum types and columns, creates the catalog link tables, links rows that carry `h_id`, carries the Hikarinagi cursor over, builds the search indexes and converts the content of comments and walkthroughs from the legacy editor's state to rich text documents (ADR 0013), keeping every original in `legacy_editor_contents`.
5. Copy Redis state that changed keys (see "Redis" in `migration.md`): the recent-update sorted set and the Bangumi tokens.
6. Let `worker` follow the change feed from the carried cursor and refresh linked entries (`catalog_refresh` queues the never-synced links first). Watch `catalog_source_links.failures`.
7. Switch traffic to `api` and smoke-test login, game pages, downloads (they need Cap, see above), uploads and search.
8. To take sponsor payments, a super admin enters the iDataRiver project id and developer secret under 「第三方服务」 in the admin settings (they are no longer environment variables, ADR 0015) and then switches 「开放赞助」 on.

Rollback before step 7: stop the compose and start the legacy backend; the forward migrations are additive except for the enum/column renames, the `hikarinagi_sync_state` replacement and the conversion of editor content (its down migration puts the kept `content` and `html` back), which have down migrations (`shionlib-api migrate` has no `down` subcommand; run golang-migrate manually if needed).
