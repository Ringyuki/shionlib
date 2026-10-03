# ADR 0003: ent for data access, golang-migrate for migrations

## Context
The database (42 tables, Postgres enums and arrays) was created by Prisma and holds production data. The rewrite needs a typed query layer and generated migrations.

## Decision
- ent schemas in `internal/adapter/postgres/ent/schema` mirror the database exactly (types, names, defaults). `cmd/entgen` generates the client.
- Migrations are golang-migrate SQL files generated from the ent schema with Atlas (`devtool migrate diff`); renames and data changes are written by hand. `devtool migrate check` fails on any drift between the schema and the migrations. All foreign keys use `ON UPDATE CASCADE` through a diff hook.
- The baseline migration is the Prisma schema; `migrate up` adopts Prisma-managed databases.
- A one-time normalization renames camelCase enum types and columns that ent cannot represent.

- Queries go through ent. Raw SQL is permitted only inside `internal/adapter/postgres` (enforced by `archtest.TestRawSQLStaysInPostgresAdapters`) for statements ent cannot express or would make non-atomic: counter increments (`downloads = downloads + 1`), aggregates and window functions for statistics, set-based recounts (`tags.count`), and `RETURNING` updates. Such SQL uses `postgres.Client(ctx, client).ExecContext/QueryContext` so it joins the active transaction, and binds every value as a `$n` parameter.

## Alternatives
GORM (runtime reflection, weak typing); sqlc (excellent but no ORM, which the project asked for); Atlas CLI (licensing and an extra binary; the Atlas Go library suffices).

## Consequences
Generated code is large and committed. ent's edge naming is constrained (no field/edge name collisions).

## Migration
Production runs `shionlib-api migrate up` once; Prisma migrations are frozen.
