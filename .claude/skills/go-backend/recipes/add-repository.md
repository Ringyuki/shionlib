# Add or extend a repository

1. Add the method to the consumer's `Repository` port with business types only.
2. Add contract cases to `<capability>test.RepositoryContract`, implement them in the memory fake.
3. Implement in `internal/adapter/postgres/<capability>pg`: use `r.db(ctx)`, map rows with `toX`, translate not-found/unique/FK errors with the constraint names from the schema.
4. Run the contract against Postgres: `TEST_DATABASE_URL=postgres://... go test ./internal/adapter/postgres/<capability>pg/`.
