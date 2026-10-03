---
name: go-backend
description: Mandatory engineering rules for the Shionlib Go backend in apps/api. Load before creating, changing, reviewing or porting any Go code in apps/api, including new modules, endpoints, repositories, adapters, jobs, migrations and tests.
---

# Shionlib Go backend

Priorities when rules compete: correctness > architecture integrity > consistency > readability > maintainability > testability > observability > performance > brevity.

> boring > clever · consistent > locally elegant · explicit > magical · repository consistency > personal preference · enforceable rules > documentation-only rules

## Layers and dependency direction

```text
cmd/api ──► internal/bootstrap (composition root)
                 │ wires everything below
   internal/transport/{http/*http, jobs/*jobs}  ──►  business  ◄──  internal/adapter/*
   internal/platform/* (config, logger, telemetry, database, redis, jobs, cache, ratelimit, realtime, i18n, httpclient, runtime, server)
   kernel: internal/apperror, internal/actor  (importable by every layer)
```

- Business package = `internal/<capability>` (favorite, game, auth, ...). It owns models, rules, ports and errors.
- Adapters implement business ports (`internal/adapter/postgres/<x>pg`, `internal/adapter/redis/<x>redis`, `internal/adapter/<vendor>`).
- Transport adapts protocols to business calls (`internal/transport/http/<x>http`, `internal/transport/jobs/<x>jobs`).
- `internal/archtest` and golangci depguard enforce this. A failing archtest means the design is wrong, not the test.

## MUST

- MUST read `apps/api/internal/favorite` (golden path) and its adapter, handler and tests before adding a module.
- MUST put code in the file its role dictates (references/architecture.md "File layout"): models in `<capability>.go`/`<capability>_<concept>.go`, interfaces in `ports.go`, errors in `errors.go`, job args in `jobs.go`, services in `service.go`/`service_<purpose>.go`; HTTP code in `handler*.go`/`request*.go`/`response*.go`; workers in `worker_<purpose>.go` plus `tasks.go`; Postgres code in `repository*.go`/`store*.go`/`mapping.go`.
- MUST name types by role: `Service`/`<Purpose>Service`, `Repository`, `<Purpose>Store`, `Handler`/`<Purpose>Handler`, `*Input` (HTTP requests), `*DTO` (HTTP responses), `<Purpose>Worker` with `New<Purpose>Worker`, `Deps`/`Options`/`Policy` (see `apps/api/docs/glossary.md`).
- MUST keep business types free of struct tags; JSON shapes live in transport DTOs and adapter records. Job args in `jobs.go` are the only exception.
- MUST keep the codebase comment-free. Encode intent in names and tests. Only `//go:` directives are allowed (archtest enforces).
- MUST inject every dependency through a constructor that returns a concrete type: `func NewService(repo Repository, ...) *Service`.
- MUST declare ports in the consuming business package (`ports.go`) with only the methods that consumer calls.
- MUST define business errors with `apperror.Define(code, NAME, Kind)` in the owning package's `errors.go`, inside a range registered in `internal/apperror/ranges.go`.
- MUST translate infrastructure errors in the adapter (not found, unique and FK violations) into business errors before they leave the adapter.
- MUST pass `actor.Actor` explicitly into service methods that need the caller; transport obtains it with `actor.From(ctx)`.
- MUST put transaction boundaries in services via the package's `Transactor` port; adapters read the active transaction with `postgres.Client(ctx, client)`.
- MUST return success bodies through `response.OK`, `response.Message`, `response.Empty` or a page built with `response.NewPage`/`NewPageMeta`, and errors as plain `error` values.
- MUST register routes with `httpapi.Register` and an explicit `httpapi.Route{ID, Method, Path, Summary, Tags, Access, Throttle}`.
- MUST validate request shape with Huma struct tags (`minLength`, `maximum`, `enum`, ...); business invariants stay in services.
- MUST use snake_case JSON for business payloads; the envelope and pagination meta keep their legacy camelCase keys.
- MUST propagate `context.Context` as the first parameter; never replace a request context with `context.Background()`.
- MUST start goroutines only inside `internal/platform` (as `runtime.Runner`s registered with `runtime.App`, or `errgroup` with a limit); everything else uses River jobs.
- MUST change the schema only through `internal/adapter/postgres/ent/schema` plus a generated migration (see recipes/add-migration.md).
- MUST add tests at the level of the change: service rules with fakes, repository contract against Postgres, black-box HTTP tests with `apitest`. `X_test.go` tests `X.go`; shared setup goes in `fixture_test.go`; every package has tests.
- MUST pass every new environment variable through `infra/compose.app.yml` (`devtool deploy env`).
- MUST run `.claude/skills/go-backend/scripts/verify.sh` before declaring work done.

## MUST NOT

- MUST NOT import transport, adapter, platform, bootstrap, ent, pgx, redis, huma, chi, river or vendor SDKs from business packages.
- MUST NOT create `IFoo`/`FooImpl`, `BaseService`, `GenericRepository[T]`, `utils`, `common`, `helpers`, `shared`, `models`, `types` or `interfaces` packages.
- MUST NOT add an interface unless a consumer needs substitution, an external boundary, a contract test or multiple implementations.
- MUST NOT log and return the same error. Errors are logged once at the boundary (HTTP access log, job error handler).
- MUST NOT compare error strings; use `errors.Is`/`errors.As` and `apperror.From`.
- MUST NOT reference HTTP status codes in business code; the status comes from the error `Kind` in `transport/http/errmap`.
- MUST NOT build ad-hoc JSON envelopes or `map[string]any` responses, and MUST NOT write JSON with `encoding/json` on a response path (use `platform/jsoncodec`).
- MUST NOT write SQL outside `internal/adapter/postgres` (ent first; raw SQL only for what ent cannot express, parameterized).
- MUST NOT use the banned type suffixes (`Manager`, `Processor`, `Usecase`, `Interactor`, `Coordinator`, `Facade`, `Helper`, `Util`, `Impl`, `Controller`).
- MUST NOT call `os.Getenv`, `fmt.Print*`, `log.Print*`, `http.Get` or `http.DefaultClient` outside the places lint allows.
- MUST NOT store services, repositories, config or DB handles in `context.Context`.
- MUST NOT edit generated code (`internal/adapter/postgres/ent/**` except `schema/`, `docs/business-codes.md`, `openapi/openapi.json`).
- MUST NOT hand-write schema migrations that Atlas can generate; hand-written SQL is only for renames, data backfills and objects ent cannot express.

## Where things go

| Question | Answer |
|---|---|
| New business module? | `go run ./cmd/devtool feature create <name> <range>` → `internal/<name>`, `<name>pg`, `<name>http` (recipes/add-feature.md) |
| What does a handler do? | decode a `*Input`, read `actor.From(ctx)`, call one service method, return `response.OK/Empty` with a `*DTO` |
| Where is business logic? | `internal/<capability>/service*.go`; nowhere else |
| Who defines the repository interface? | the consuming capability, in `ports.go` |
| How are dependencies created? | explicit `New<Type>` constructors called in `internal/bootstrap/wire_*.go` |
| Success response? | `response.OK(ctx, h.resp, dto)`, `response.Empty`, `response.NewPage`/`MapPage` |
| Error response? | return `<capability>.ErrX` (or `.Wrap(cause)`); `errmap` produces status, code and message |
| Where are business codes? | `internal/<capability>/errors.go`, ranges in `internal/apperror/ranges.go`, list in `apps/api/docs/business-codes.md` |
| New business code? | register the range, `apperror.Define`, add `shion-biz.<NAME>` in three locales, `devtool bizcode docs` |
| Validation errors? | Huma tags on the `*Input`; failures become 422 `COMMON_VALIDATION_FAILED` with `data.errors` |
| When to log an error? | only at a boundary: access log (HTTP), `platform/jobs` error handler (jobs), `cmd/api` (startup/shutdown) |
| Where are transactions? | in services via the `Transactor` port; adapters join with `postgres.Client(ctx, client)` |
| How is context passed? | first parameter everywhere; never `context.Background()` in request paths |
| Database access? | ent in `internal/adapter/postgres/<capability>pg`, behind a port |
| Redis access? | `internal/adapter/redis/<capability>redis` or `platform/cache`/`ratelimit`, behind a port |
| Calling an AI model? | declare an `ai.SceneDefinition` (key, label, output), register it in `wireAI`, and call `ai.Service.Object/Text/Moderate` through a port in the consuming capability or an adapter like `internal/adapter/aimoderation`; models and keys are configured in the admin panel (ADR 0010) |
| External services? | a port in the capability, an adapter in `internal/adapter/<vendor>` with a `platform/httpclient` client (recipes/add-external-client.md) |
| Starting a goroutine? | don't: enqueue a River job, add a `jobs.Task`, or add a `runtime.Runner` in `internal/platform` |
| Graceful shutdown? | `runtime.App` cancels runners, the HTTP server drains, closers run in reverse order under `SHUTDOWN_TIMEOUT` |
| Writing tests? | references/testing.md; copy `internal/favorite` tests |
| Verifying the architecture? | `go test ./internal/archtest/` and `golangci-lint run` (both in `scripts/verify.sh` and CI) |
| Porting a legacy module? | recipes/migrate-module.md and `apps/api/docs/migration.md` |

## Workflow for every change

1. Read root `AGENTS.md`, this skill and the reference for the area you touch.
2. Read the target package, its tests, the ports it uses and the golden path.
3. Check `internal/platform` and existing adapters for the capability you need before adding one.
4. Implement the minimum coherent change; record unrelated refactors instead of doing them.
5. Regenerate what you changed: `go run ./cmd/entgen`, `go run ./cmd/devtool migrate diff <name>`, `go run ./cmd/devtool bizcode docs`, `go run ./cmd/api openapi openapi/openapi.json`.
6. Run `scripts/verify.sh` and fix everything it reports.

## References

- references/architecture.md — layers, package roles, naming, glossary pointers
- references/errors.md — business codes, kinds, translation, logging once
- references/http.md — routes, access, validation, response contract, pagination, cookies
- references/data.md — ent, repositories, transactions, migrations, contract tests
- references/runtime.md — config, context, concurrency, jobs, cache, rate limits, outbound HTTP, observability, security
- references/testing.md — test levels, fakes, integration environment
- recipes/add-feature.md, add-endpoint.md, add-repository.md, add-migration.md, add-external-client.md, add-worker.md, migrate-module.md
- `apps/api/docs/` — human-oriented architecture, API contract, error model, ADRs and glossary

## Verification

```bash
.claude/skills/go-backend/scripts/verify.sh            # format, tidy, generate, vet, lint, tests, archtest, bizcodes, openapi
TEST_DATABASE_URL=... TEST_REDIS_ADDR=... DEV_DATABASE_URL=... scripts/verify.sh   # adds integration tests and migration drift
```

`verify.sh` also checks the deploy environment block (`devtool deploy check`). CI runs it plus `go test -race ./...` and `govulncheck`.
