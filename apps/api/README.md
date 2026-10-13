# Shionlib API

Go backend for Shionlib. See [docs/architecture.md](docs/architecture.md) for the design and `.claude/skills/go-backend` for the engineering rules.

## Requirements

Go 1.27, PostgreSQL 17, Redis 7+, golangci-lint v2.14.

## Run locally

```bash
cp .env.example .env            # adjust DATABASE_URL, REDIS_*, TOKEN_SECRET, REFRESH_TOKEN_PEPPER
set -a; . ./.env; set +a
go run ./cmd/api migrate up
scripts/dev.sh                  # HTTP API and jobs in one process, rebuilt and restarted on every change
```

`scripts/dev.sh` runs [air](https://github.com/air-verse/air) (pinned in `tools.mod`, started with `go tool -modfile=tools.mod air`) with `.air.toml`. It reads `.env`, or the file in `API_ENV_FILE`, without overriding variables that are already set. One process is enough for development: `serve` also runs the jobs unless `WORKERS_ENABLED=false`. To run them apart, start `WORKERS_ENABLED=false scripts/dev.sh serve` and `PORT=5811 scripts/dev.sh worker`; each role has its own binary under `tmp/`. From the repository root, `pnpm dev:api` and `pnpm dev:worker` do the same.

The reloader is built not to pile up work: `scripts/dev-build.sh` cancels the build still running before it starts the next one, so there is one build per role at any time, capped at two compile jobs (`DEV_BUILD_JOBS`); a build during which a source file changed is repeated, so a build that caught a code generator halfway never leaves the server down; files rewritten with the same content, as code generators and rebases do, are ignored (`exclude_unchanged`); and `scripts/dev-run.sh` stops an instance left over from the previous run before it starts the new one.

## Commands

| Command | Purpose |
|---|---|
| `go run ./cmd/api serve` | HTTP API (and jobs when `WORKERS_ENABLED=true`) |
| `go run ./cmd/api worker` | jobs and scheduled tasks only |
| `go run ./cmd/api migrate up` | apply migrations (adopts a Prisma-managed database) |
| `go run ./cmd/api openapi openapi/openapi.json` | regenerate the OpenAPI document |
| `go run ./cmd/api health` | liveness probe used by the container healthcheck |
| `go run ./cmd/entgen` | regenerate ent code from `internal/adapter/postgres/ent/schema` |
| `go run ./cmd/devtool migrate diff <name>` | generate a migration from schema changes (needs `DEV_DATABASE_URL`) |
| `go run ./cmd/devtool migrate check` | fail if migrations and schema drifted |
| `go run ./cmd/devtool bizcode check` / `docs` | validate / regenerate business codes |
| `go run ./cmd/devtool feature create <name> <range>` | scaffold a capability |
| `go run ./cmd/devtool deploy env` / `deploy check` | print / verify the environment block of `infra/compose.app.yml` |
| `go run ./cmd/devtool e2e prepare` | reset the database and Redis prefix and load the Playwright e2e dataset (`reset` and `seed` run one half; see `docker/README.md`) |
| `../../.claude/skills/go-backend/scripts/verify.sh` | everything CI runs |

## Deploy

The image is built from `apps/api/Dockerfile`; `infra/compose.app.yml` runs it as `migrate`, `api` and `worker` beside the web client, ClamAV and Cap, and passes every variable the API reads (`.env.example` lists them with their defaults). `infra/compose.data.yml` provides PostgreSQL 17 and Redis for an environment without its own. Traces: [docs/observability.md](docs/observability.md).

## Tests

```bash
go test ./...                                                     # unit and HTTP tests
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable \
TEST_REDIS_ADDR=localhost:6379 go test ./...                      # plus integration tests
```
