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
