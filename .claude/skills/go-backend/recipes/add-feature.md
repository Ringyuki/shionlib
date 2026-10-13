# Add a capability

1. `go run ./cmd/devtool feature create <name> <range>` (run in `apps/api`). It registers the business-code range in `internal/apperror/ranges.go`, runs `cmd/entgen`, and writes only the project layout:
   - `internal/<name>/`: `<name>.go` (model), `errors.go`, `ports.go`, `service.go`, `service_test.go`, `<name>test/{memory.go,contract.go,memory_test.go}`
   - `internal/adapter/postgres/ent/schema/<name>.go`
   - `internal/adapter/postgres/<name>pg/`: `repository.go`, `mapping.go`, `repository_test.go`
   - `internal/transport/http/<name>http/`: `handler.go`, `request.go`, `response.go`
2. `DEV_DATABASE_URL=... go run ./cmd/devtool migrate diff create_<name>s` and review the migration.
3. Add `shion-biz.<NAME>` messages for new errors in all three locales, run `go run ./cmd/devtool bizcode docs`.
4. Grow the model in `<name>.go` (no tags) and further concepts in `<name>_<concept>.go`; keep every interface in `ports.go`.
5. Write `service_test.go` against the memory fake first; extend `RepositoryContract` for every semantic the service relies on and implement it in the fake and in `<name>pg`.
6. Add inputs to `request.go`, DTOs to `response.go`, routes to `handler.go`, and `handler_test.go` through `apitest`.
7. Add a `wire<Name>(infra, shared, modules)` function to a `internal/bootstrap/wire_<area>.go` file that constructs the repository, service and handler with their constructors and appends the handler to `modules.Handlers`; list it in `wirings` in `internal/bootstrap/modules.go`.
8. Regenerate OpenAPI (`go run ./cmd/api openapi openapi/openapi.json`) and run `scripts/verify.sh`.
