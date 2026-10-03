# Shionlib API

Go backend for Shionlib. See [docs/architecture.md](docs/architecture.md) for the design and `.claude/skills/go-backend` for the engineering rules.

## Requirements

Go 1.27, PostgreSQL 16+, Redis 7+, golangci-lint v2.14.

## Run locally

```bash
cp .env.example .env            # adjust DATABASE_URL, REDIS_*, TOKEN_SECRET, REFRESH_TOKEN_PEPPER
set -a; . ./.env; set +a
go run ./cmd/api migrate up
go run ./cmd/api serve
```

## Commands

| Command | Purpose |
|---|---|
| `go run ./cmd/api serve` | HTTP API (and jobs when `WORKERS_ENABLED=true`) |
| `go run ./cmd/api worker` | jobs and scheduled tasks only |
| `go run ./cmd/api migrate up` | apply migrations (adopts a Prisma-managed database) |
| `go run ./cmd/api openapi openapi/openapi.json` | regenerate the OpenAPI document |
| `go run ./cmd/entgen` | regenerate ent code from `internal/adapter/postgres/ent/schema` |
| `go run ./cmd/devtool migrate diff <name>` | generate a migration from schema changes (needs `DEV_DATABASE_URL`) |
| `go run ./cmd/devtool migrate check` | fail if migrations and schema drifted |
| `go run ./cmd/devtool bizcode check` / `docs` | validate / regenerate business codes |
| `go run ./cmd/devtool feature create <name> <range>` | scaffold a capability |
| `../../.claude/skills/go-backend/scripts/verify.sh` | everything CI runs |

## Tests

```bash
go test ./...                                                     # unit and HTTP tests
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable \
TEST_REDIS_ADDR=localhost:6379 go test ./...                      # plus integration tests
```
