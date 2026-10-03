# Data access

## Stack

- PostgreSQL through `pgx/v5` (`internal/platform/database`): one `pgxpool.Pool`, shared with `database/sql` via `stdlib.OpenDBFromPool`.
- ORM: ent, generated into `internal/adapter/postgres/ent` from `internal/adapter/postgres/ent/schema`. Regenerate with `go run ./cmd/entgen`.
- Migrations: golang-migrate files in `apps/api/migrations` (`<version>_<name>.up.sql` / `.down.sql`), embedded into the binary and applied by `shionlib-api migrate up`, which also adopts databases created by the legacy Prisma backend.
- Only adapters under `internal/adapter/postgres` touch ent. Business packages see their own models.

## Schema conventions (mirror the existing database)

- IDs: `serialID()`. Timestamps: `field.Time(...).SchemaType(timestamp3)`, plus `created()`/`updated()` helpers. Strings: `field.Text` for `text`, `field.String(...).MaxLen(n).SchemaType(varchar(n))` for `varchar(n)`. Integers that are `integer` in Postgres: `field.Int(...).SchemaType(pg("integer"))`.
- Arrays: `field.Other(name, stringsType|intsType).SchemaType(textArray|intArray)` with `emptyArray("text[]")` defaults. Enums: `field.Enum(...).SchemaType(pgEnum("snake_case_type"))`; new columns prefer `varchar` + Go validation over new Postgres enums.
- JSON: `field.JSON(name, rawJSON).SchemaType(jsonbType)`; decode into typed structs in the adapter.
- Name every index and FK explicitly with `StorageKey` using Postgres defaults (`<table>_<cols>_idx`, `_key`, `_fkey`). FK `ON DELETE` via `entsql.OnDelete`; `ON UPDATE CASCADE` is applied by the diff hook for all FKs.
- Expression defaults use `entsql.DefaultExpr`, never `entsql.Default`.

## Repositories

- Constructor `NewRepository(client *ent.Client) *Repository`; every method starts with `r.db(ctx)` = `postgres.Client(ctx, r.client)` so it joins an active transaction.
- Return business models, never ent structs. Map with small `toX` functions in the adapter.
- Translate errors (see errors.md). Wrap other errors with `fmt.Errorf("verb object: %w", err)`.
- Lists are always bounded: paginate with `Offset/Limit`, cap batch reads.
- Raw SQL is allowed in adapters for queries ent cannot express; use `postgres.Client(ctx, r.client).QueryContext`/`ExecContext` with `$n` parameters only.

## Transactions

- The service decides atomicity: `s.tx.WithinTransaction(ctx, func(ctx context.Context) error { ... })` where `tx` is the package's `Transactor` port, wired to `postgres.NewTransactor(client)`.
- Nested calls join the outer transaction. Use `ForUpdate()` reads (`Lock` repository methods) when a check-then-write must be serialized.
- Do not call external services or enqueue jobs inside a transaction unless the side effect is idempotent; enqueue after commit.
- Isolation is READ COMMITTED unless a reason is recorded in an ADR.

## Contract tests

Every repository port with more than trivial semantics ships `<capability>test.RepositoryContract(t, newEnv)`. The memory fake and the Postgres adapter both run it. New behavior is added to the contract first.
