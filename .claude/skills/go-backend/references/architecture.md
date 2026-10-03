# Architecture rules

## Package roles

| Path | Role | May import |
|---|---|---|
| `internal/apperror`, `internal/actor` | Kernel: error definitions, caller identity | stdlib |
| `internal/lexical`, `internal/paging`, `internal/patch`, `internal/txtest` | Libraries shared by capabilities: Lexical document format, `paging.Page` (capabilities alias it as `Page`), `patch.Clearable[T]` for set/clear/untouched updates, immediate transactor for tests; exempt from the capability file layout | kernel, business |
| `internal/<capability>` | Business capability: models, services, ports, errors, job args | kernel, other business packages, allow-listed modules (`golang.org/x/sync`, `golang.org/x/text`, `github.com/google/uuid`) |
| `internal/<capability>/<capability>test` | Memory fakes and contract suites for that capability | same as business + `testing` |
| `internal/platform/*` | Cross-cutting infrastructure (config, logger, telemetry, database, redis, jobs, cache, ratelimit, realtime, i18n, jsoncodec, httpclient, runtime, server) | kernel, platform, generated code |
| `internal/adapter/*` | Implementations of business ports (Postgres, Redis, vendors, queue, push) | kernel, business, platform, generated code |
| `internal/transport/http/*` | HTTP handlers and HTTP infrastructure (`httpapi`, `errmap`, `response`, `middleware`, `reqstate`, `clientinfo`, `apitest`, `lexicalhttp`) | kernel, business, platform, transport |
| `internal/transport/jobs/*` | River workers and scheduled tasks that call business services | kernel, business, platform, transport |
| `internal/bootstrap` | Composition root | everything except `cmd` |
| `cmd/api` | Process entrypoint: `serve`, `worker`, `migrate`, `openapi`, `health`, `search reindex` | everything |
| `cmd/devtool`, `cmd/entgen`, `internal/archtest` | Tooling | everything |

`internal/archtest` and golangci depguard encode this table; change the table and the tests together, with an ADR.

## File layout (enforced by `archtest.TestPackageStructure`)

### Capability `internal/<capability>/`

| File | Contains |
|---|---|
| `<capability>.go` | the core model types, constants and lookup tables; MUST declare at least one type |
| `<capability>_<concept>.go` | further model types, constants and pure functions for one concept (`game_hot_score.go`, `auth_passkey.go`, `moderation_policy.go`) |
| `ports.go` | every interface the capability consumes, and nothing else |
| `errors.go` | every `apperror.Define` / `errors.New` value, and nothing else |
| `jobs.go` | River job args (types with `Kind()`); the only place struct tags are allowed |
| `service.go` | `Service`, its `Deps`/`Options`, `NewService`, methods and unexported helper functions; no other types, constants or variables |
| `service_<purpose>.go` | `<Purpose>Service` (`CodeService`, `HotScoreService`), its `<Purpose>Deps`/`Options`, constructor, methods and helpers, under the same restriction |
| `<capability>test/` | `memory.go` (fakes), `contract.go` (`RepositoryContract`), `memory_test.go` |

- An exported type that holds injected ports is a service and MUST be named `Service` or `<Purpose>Service`.
- Business types carry no struct tags (`archtest.TestBusinessTypesCarryNoTags`). Wire shapes live in transport DTOs, storage shapes in adapter records; job args in `jobs.go` are the exception because River serializes them.
- Split a large capability by concept (`service_admin.go`, `game_admin.go`), never into technical sub-directories.

### HTTP `internal/transport/http/<capability>http/`

| File | Contains |
|---|---|
| `handler.go`, `handler_<purpose>.go` | `Handler` / `<Purpose>Handler`, its `Deps`/`Options`, consumed interfaces, `Register` and the handler methods |
| `request.go`, `request_<purpose>.go` | input structs named `*Input` (Huma tags, `Body` field) |
| `response.go`, `response_<purpose>.go` | output structs named `*DTO` (snake_case JSON) and `to<X>DTO` mappers |

### Jobs `internal/transport/jobs/<capability>jobs/`

| File | Contains |
|---|---|
| `worker_<purpose>.go` | exported `<Purpose>Worker` with `New<Purpose>Worker`, `Work`, optional `Timeout`/`NextRetry` |
| `tasks.go` | `Register(...) func(*river.Workers)` and `Tasks(...) []jobs.Task` |

### Postgres `internal/adapter/postgres/<capability>pg/`

| File | Contains |
|---|---|
| `repository.go`, `repository_<purpose>.go` | `Repository`: implements the capability's own `Repository` port |
| `store.go`, `store_<purpose>.go` | `<Purpose>Store`: read models or data owned elsewhere (`gamepg.CardStore`) |
| `mapping.go` | `to<X>` row → model functions and storage records |

### Tests

`X_test.go` mirrors `X.go`; `X_internal_test.go` is the same in package `X`; shared setup goes in `fixture_test.go` (`archtest.TestTestFilesMirrorSourceFiles`). Every package with production code has tests (`archtest.TestEveryPackageHasTests`).

## Naming

| Concept | Name |
|---|---|
| business entry point | `Service`, `<Purpose>Service` |
| persistence of own data | `Repository` (port and adapter) |
| read model / foreign data | `<Thing>Store` |
| HTTP | `Handler`, `<Purpose>Handler`; inputs `*Input`; outputs `*DTO` |
| queued work | `<Purpose>Worker`; scheduled work `jobs.Task` |
| vendor adapter | `Client` (outbound API), `Source` (catalog provider), `Sender`/`Mailer`, `Verifier` |
| constructor | `New<Type>` returning the concrete type |
| errors | `Err<Condition>` in `errors.go` (`favorite.ErrNotFound`) |

Banned type suffixes (`archtest`): `Manager`, `Processor`, `Usecase`, `UseCase`, `Interactor`, `Coordinator`, `Facade`, `Helper`, `Util(s)`, `Impl`, `Controller`. Banned package names: `util(s)`, `common`, `helper(s)`, `base`, `misc`, `shared`, `core`, `models`, `interfaces`, `types`. Packages are short, lower case, singular; transport packages end in `http`/`jobs`, Postgres adapters in `pg`, Redis adapters in `redis`. Vocabulary: `apps/api/docs/glossary.md`.

## Explicit wiring

`wire<Area>` functions in `internal/bootstrap/wire_*.go`, listed in `wirings` in `modules.go`, construct every service with explicit constructors. No DI container, no service locator, no package-level mutable dependencies. Handlers implement `Register(api *httpapi.API)` and are appended to `Modules.Handlers`. Workers are added through `<capability>jobs.Register(...)` to `Modules.Jobs.Register`, scheduled tasks through `<capability>jobs.Tasks(...)` to `Modules.Jobs.Tasks`.

## Interfaces

Create an interface only when a consumer needs substitutable behavior, an external boundary must be isolated, a contract test exists, or there are several implementations. Keep it in the consumer's `ports.go` with only the methods it calls. Return concrete types from constructors.

## Runtime boundaries (enforced by `archtest`)

- `go` statements only in `internal/platform` (`TestGoroutinesHaveOwners`); everything else uses `runtime.Runner`, River jobs or `errgroup` inside platform code.
- No `context.Background()`/`context.TODO()` outside `cmd`, `bootstrap` and test support (`TestRequestPathsKeepTheirContext`; the one allow-listed exception carries its reason).
- Loggers are created only in `internal/platform/logger` (`TestLoggersComeFromThePlatform`).
- `ExecContext`/`QueryContext`/`QueryRowContext` only in `internal/adapter/postgres` and `internal/platform/database` (`TestRawSQLStaysInPostgresAdapters`).
