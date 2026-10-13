# Add or extend a repository

1. Add the method to the consumer's `Repository` port in `ports.go` with business types only.
2. Add contract cases to `<capability>test.RepositoryContract`, implement them in the memory fake.
3. Implement in `internal/adapter/postgres/<capability>pg/repository*.go` (or `store_<purpose>.go` for a read model): use `r.db(ctx)`, map rows with `to<X>` in `mapping.go`, translate not-found/unique/FK errors with the constraint names from the schema. JSON columns are written from records declared in `mapping.go`.
4. Run the contract against Postgres: `TEST_DATABASE_URL=postgres://... go test ./internal/adapter/postgres/<capability>pg/`.
