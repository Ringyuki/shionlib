# Change the database schema

1. Edit `internal/adapter/postgres/ent/schema/*.go` (see references/data.md conventions).
2. `go run ./cmd/entgen`.
3. Start an empty scratch database and run `DEV_DATABASE_URL=postgres://.../scratch?sslmode=disable go run ./cmd/devtool migrate diff <snake_case_name>`. Review the generated `migrations/<version>_<name>.up.sql`/`.down.sql`.
4. Renames, data backfills, table drops and objects ent cannot express are written by hand in a migration with the same naming scheme. Never rename by drop+add.
5. `go run ./cmd/devtool migrate check` must report no drift; `go test ./...` rebuilds the integration template automatically.
6. Migrations must be safe on the live database: add columns as nullable or with defaults, backfill in batches, create large indexes `CONCURRENTLY` in a hand-written migration.
