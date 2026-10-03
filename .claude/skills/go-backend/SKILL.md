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
- MUST give every goroutine an owner, a stop condition and error handling; prefer `errgroup` and `runtime.App`.
- MUST change the schema only through `internal/adapter/postgres/ent/schema` plus a generated migration (see recipes/add-migration.md).
- MUST add tests at the level of the change: service rules with fakes, repository contract against Postgres, black-box HTTP tests with `apitest`.
- MUST pass every new environment variable through `infra/compose.app.yml` (`devtool deploy env`).
- MUST run `.claude/skills/go-backend/scripts/verify.sh` before declaring work done.

## MUST NOT

- MUST NOT import transport, adapter, platform, bootstrap, ent, pgx, redis, huma, chi, river or vendor SDKs from business packages.
- MUST NOT create `IFoo`/`FooImpl`, `BaseService`, `GenericRepository[T]`, `utils`, `common`, `helpers`, `shared`, `models`, `types` or `interfaces` packages.
- MUST NOT add an interface unless a consumer needs substitution, an external boundary, a contract test or multiple implementations.
- MUST NOT log and return the same error. Errors are logged once at the boundary (HTTP access log, job error handler).
- MUST NOT compare error strings; use `errors.Is`/`errors.As` and `apperror.From`.
- MUST NOT reference HTTP status codes in business code; the status comes from the error `Kind` in `transport/http/errmap`.
- MUST NOT build ad-hoc JSON envelopes or `map[string]any` responses.
- MUST NOT call `os.Getenv`, `fmt.Print*`, `log.Print*`, `http.Get` or `http.DefaultClient` outside the places lint allows.
- MUST NOT store services, repositories, config or DB handles in `context.Context`.
- MUST NOT edit generated code (`internal/adapter/postgres/ent/**` except `schema/`, `docs/business-codes.md`, `openapi/openapi.json`).
- MUST NOT hand-write schema migrations that Atlas can generate; hand-written SQL is only for renames, data backfills and objects ent cannot express.

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
