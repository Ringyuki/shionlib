# Docker Compose

This setup provides a local full-stack runtime for Shionlib:

- frontend on `http://localhost:3100` (container port `3000`)
- backend on `http://localhost:5001` (container port `5000`)
- clamav (`clamd`) on internal network (`clamd:3310`)
- postgres on internal network (`postgres:5432`)
- redis on internal network (`redis:6379`)

## Quick Start

```bash
docker compose up --build
```

Stop and remove containers:

```bash
docker compose down
```

Remove containers and volumes:

```bash
docker compose down -v
```

## Environment Files

- backend env: `docker/env/backend.env`
- frontend env: `docker/env/frontend.env`

These files contain safe local defaults. Adjust them for your local test needs.

## Notes

- Backend startup runs `prisma db push` automatically before `node dist/main.js`.
- `docker/env/backend.env` includes local placeholder `S3_*` settings so Nest can boot without cloud credentials.
- Local container default enables file scan via a dedicated `clamav` service (`CLAMDSCAN_HOST=clamav`).
- On first startup, `clamav` downloads virus database files, so health checks may take longer.
- postgres/redis are intentionally not published to host ports in this compose setup.
- Frontend build bakes in `INTERNAL_API_BASE_URL=http://backend:5000` and rewrites `/api/*` to backend.
- For production deployment, use dedicated secrets/config management instead of these local env defaults.

## E2E against the Go API

`docker/compose.e2e-go.yml` (project `shionlib-e2e-go`) runs the legacy frontend and its Playwright suite against the Go backend in `apps/api`:

- frontend on `http://localhost:3200`, Go API on `http://localhost:5201`, og on `http://localhost:4200`
- `migrate` runs `shionlib-api migrate up` on an empty database, `seed` runs `devtool e2e prepare` (the Go port of `e2e-dataset.ts prepare`, image `docker/api-e2e/Dockerfile`), then `api` serves with workers enabled
- API settings live in `docker/env/api-e2e.env`; they mirror `docker/env/backend.env` (same secrets, token windows, Redis DB, scan and download settings) and additionally set `DEFAULT_LOCALE=en`, a high `THROTTLE_AUTH_LIMIT` and an `AI_KEY_SECRET`; the dataset configures an AI provider at an unreachable address for both moderation scenes, so moderation fails and new content stays pending like it did with the empty legacy key

```bash
pnpm test:e2e:go                 # build, start, seed, run Playwright, tear down
E2E_KEEP_STACK=1 pnpm test:e2e:go tests/e2e/smoke   # keep the stack, run a subset
pnpm e2e:go:data:prepare         # reset and reseed a running stack
pnpm e2e:go:stack:down
```

`docker/scripts/test-e2e-go.sh` excludes the specs that contradict an intentional deviation listed in `apps/api/docs/migration.md` and prints each exclusion. It runs Playwright with two workers like CI (`E2E_WORKERS` overrides it); several UI specs share users and race each other at higher worker counts against either backend.
