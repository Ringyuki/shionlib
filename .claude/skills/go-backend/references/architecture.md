# Architecture rules

## Package roles

| Path | Role | May import |
|---|---|---|
| `internal/apperror`, `internal/actor` | Kernel: error definitions, caller identity | stdlib |
| `internal/<capability>` | Business capability: models, services, ports, errors | kernel, other business packages, allow-listed modules (`golang.org/x/sync`, `golang.org/x/text`, `github.com/google/uuid`) |
| `internal/<capability>/<capability>test` | Fakes and contract suites for that capability | same as business + `testing` |
| `internal/platform/*` | Cross-cutting infrastructure (config, logger, database, redis, jobs, cache, ratelimit, i18n, httpclient, runtime, server) | kernel, platform, generated code |
| `internal/adapter/*` | Implementations of business ports (Postgres, Redis, vendors, queue) | kernel, business, platform, generated code |
| `internal/transport/http/*` | HTTP handlers and HTTP infrastructure (`httpapi`, `errmap`, `response`, `middleware`) | kernel, business, platform, transport |
| `internal/transport/jobs/*` | River workers that call business services | kernel, business, platform, transport |
| `internal/bootstrap` | Composition root | everything except `cmd` |
| `cmd/api` | Process entrypoint: `serve`, `worker`, `migrate`, `openapi` | everything |
| `cmd/devtool`, `cmd/entgen`, `internal/archtest` | Tooling | everything |

`internal/archtest` encodes this table; change the table and the test together, with an ADR.

## Capability package layout

```text
internal/<capability>/
  <capability>.go     models and constants (no tags for DB or JSON)
  service.go          Service struct, constructor, business rules
  ports.go            consumer-owned interfaces (Repository, Transactor, other capabilities)
  errors.go           apperror.Define(...) values
  service_test.go     rule tests with fakes
  <capability>test/   memory fakes, RepositoryContract
internal/adapter/postgres/<capability>pg/
  repository.go       implements the Repository port, translates errors
  repository_test.go  runs <capability>test.RepositoryContract against Postgres
internal/transport/http/<capability>http/
  handler.go          Register + thin handler methods
  dto.go              input structs (Huma tags) and output DTOs (snake_case JSON)
  handler_test.go     black-box tests through apitest
```

Split a large capability by sub-resource files (`service_items.go`), not by technical layer directories.

## Naming

- Services are `Service`; stores of read models are `<Thing>Store`; adapters implementing `Repository` are `Repository` in their own package.
- Constructors are `New<Type>`. Packages are short, lower case, singular, no underscores.
- Transport packages end in `http`/`jobs`; Postgres adapters end in `pg`; Redis adapters end in `redis`.
- Errors: `Err<Condition>` (`ErrNotFound`, `ErrNotOwner`) inside the capability package, so call sites read `favorite.ErrNotFound`.
- See `apps/api/docs/glossary.md` for the vocabulary (capability, service, port, adapter, handler, worker, task).

## Explicit wiring

`internal/bootstrap/modules.go` constructs every service with explicit constructors. No DI container, no service locator, no package-level mutable dependencies. Handlers implement `Register(api *httpapi.API)` and are appended to `Modules.Handlers`. Jobs are declared in `Modules.Jobs` (workers and scheduled tasks).

## Interfaces

Create an interface only when a consumer needs substitutable behavior, an external boundary must be isolated, a contract test exists, or there are several implementations. Keep it in the consumer's `ports.go` with only the methods it calls. Return concrete types from constructors.
