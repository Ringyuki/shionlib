# Testing

| Level | Location | Dependencies |
|---|---|---|
| Rules | `internal/<capability>/service_test.go` | memory fakes from `<capability>test` |
| Repository contract | `<capability>test/contract.go`, run by `<capability>test/memory_test.go` and `adapter/postgres/<capability>pg/repository_test.go` | real Postgres via `pgtest.New(t)` |
| Adapter integration | `internal/adapter/**/_test.go` | Postgres (`pgtest`), Redis (`redistest`), `httptest.Server` for vendors |
| HTTP contract | `internal/transport/http/<capability>http/handler_test.go` | `apitest.New(t)` + real service + memory fakes |
| Architecture | `internal/archtest` | none |

Rules:

- Prefer fakes and in-memory implementations over mocks; never assert call counts on internal collaborators.
- Assert status, business code and the exact JSON shape for contract-relevant responses.
- Test failure paths and authorization explicitly; every business error a service returns has a test.
- Integration tests skip when `TEST_DATABASE_URL`/`TEST_REDIS_ADDR` are unset, and fail when `REQUIRE_INTEGRATION=1` (CI).
- Use `apitest.Token(actor)` style tokens (`user:<id>:<role>:<content_limit>`) in HTTP tests.
- Run `go test -race ./...` for packages with goroutines.
