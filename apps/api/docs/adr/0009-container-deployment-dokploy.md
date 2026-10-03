# ADR 0009: Container images deployed with Dokploy

## Context
The legacy backend, frontend and OG service run under pm2 on a VM, deployed by SSH from GitHub Actions. Runtime tools (`7zz`, `pg_dump`, ClamAV) are installed on the host by hand, and environment changes need shell access.

## Decision
The API ships as one multi-arch image (`ghcr.io/<owner>/shionlib-api`) built from `apps/api/Dockerfile` with the official static `7zz` (pinned by SHA-256) and `postgresql-client`. `infra/compose.app.yml` defines `migrate` (runs `migrate up` before every deploy), `api`, `worker` and `clamav`; Dokploy deploys it from git and supplies values through its environment field. The compose file passes every configuration variable explicitly; `devtool deploy check` keeps it in sync with `internal/platform/config`. `deploy-api.yml` points the compose at an image tag through the Dokploy API and triggers a deploy.

## Alternatives
Keep pm2 (no reproducible runtime, manual tool installs); Kubernetes (operational overhead out of proportion for one site); Dokploy application per service instead of one compose (migrations and shared volumes harder to order).

## Consequences
`api` and `worker` share the upload volume and must run on the same host. Images are the unit of rollback. Postgres and Redis stay external services.

## Migration
Follow the cutover steps in `docs/deployment.md`: stop the pm2 backend, deploy the compose (its `migrate` service adopts the Prisma database), copy the Redis keys listed in `docs/migration.md`, then switch traffic.
