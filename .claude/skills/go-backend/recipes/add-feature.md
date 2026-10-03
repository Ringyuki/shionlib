# Add a capability

1. `go run ./cmd/devtool feature create <name>` scaffolds `internal/<name>`, `internal/<name>/<name>test`, `internal/adapter/postgres/<name>pg` and `internal/transport/http/<name>http` following the favorite layout.
2. Register a code range in `internal/apperror/ranges.go`, define errors in `errors.go`, add `shion-biz.<NAME>` messages in all three locales, run `go run ./cmd/devtool bizcode docs`.
3. Model the capability in `<name>.go` (no DB/JSON tags). Write the service and its `ports.go`.
4. Write `service_test.go` against the memory fake first.
5. Implement the Postgres repository; extend `RepositoryContract` for every semantic the service relies on.
6. Add the handler and DTOs, then `handler_test.go` through `apitest`.
7. Wire constructors in `internal/bootstrap/modules.go` and append the handler to `Modules.Handlers`.
8. Regenerate OpenAPI (`go run ./cmd/api openapi openapi/openapi.json`) and run `scripts/verify.sh`.
