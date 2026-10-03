# Engineering spec compliance

How each section of the Go backend engineering spec is met. **Enforced** means CI fails when the rule is broken (`verify.sh`, `go test -race`, `govulncheck`); **Reviewed** means the rule is written in the skill and the review checklist but cannot be decided by a machine; **Deferred** records why a part is not in place and what will trigger it.

| § | Requirement | How it is met | Enforcement | Status |
|---|---|---|---|---|
| 1 | Skill, rules, contracts, golden path, scaffold, lint, CI, workflow, ADRs as files and checks | `.claude/skills/go-backend` (SKILL, references, recipes, `scripts/verify.sh`), `apps/api/docs`, `internal/archtest`, `.golangci.yml`, `.github/workflows/api.yml`, `cmd/devtool` | this table | Enforced |
| 2 | boring/explicit; no `IFoo`/`FooImpl`; interfaces only for real boundaries | SKILL.md priorities; banned suffixes include `Impl`; interfaces only in consumer `ports.go` | `archtest.TestPackageStructure` | Enforced |
| 3 | Business independent of transport, DB, Redis, web framework, vendor SDKs | layer table in references/architecture.md | `archtest.TestLayerDependencies`, `TestBusinessExternalDependencies`, depguard | Enforced |
| 4 | Capability-first layout, no `utils`/`helpers`/`common`/`misc` | `internal/<capability>` + `adapter`/`transport`/`platform`; per-kind file layout | `archtest.TestPackageNames`, `TestPackageStructure` | Enforced |
| 5 | Packages with one owner and small surface; no catch-all packages | `apperror.Ranges` names the owner of every code range; banned package names | `TestPackageNames`, `devtool bizcode check` | Enforced |
| 6 | Explicit constructor injection; no container, locator, context DI or mutable globals | `New<Type>` constructors wired in `internal/bootstrap/wire_*.go`; context carries only request id, locale, actor, stale-token signal, request state, client info | constructors: `TestPackageStructure` (service naming); globals and context use: SKILL MUST NOT + checklist | Enforced / Reviewed |
| 7 | Small consumer-owned interfaces, concrete returns | interfaces declared only in `ports.go` of the consumer | `TestPackageStructure` (interfaces outside `ports.go` fail) | Enforced |
| 8 | SOLID as rules; contract tests across implementations | `favoritetest.RepositoryContract` and siblings run against memory fakes and Postgres; `authtest.StoreContract` against memory and Redis; `catalogtest` store contract | tests in CI with `REQUIRE_INTEGRATION=1` | Enforced |
| 9 | Thin handlers; no SQL, Redis, transactions in transport | handler files hold `Register` + one service call per route | depguard (transport may not import ent, pgx, `database/sql`, adapters), `TestRawSQLStaysInPostgresAdapters`, HTTP layout check | Enforced |
| 10 | One response contract, no `map[string]any` envelopes | `response.OK/Message/Empty/NewPage`, `errmap.ErrorResponse`; DTO-only outputs (`*DTO` in `response*.go`), unions as sealed `<purpose>DTO` interfaces, opaque JSON as `json.RawMessage` | `TestPackageStructure` rejects `any`/`interface{}`/`map[string]any` in response DTOs | Enforced |
| 11 | Stable business codes, owned ranges, duplicate detection | `apperror.Define` in each `errors.go`; ranges in `apperror/ranges.go`; generated `docs/business-codes.md` | `devtool bizcode check` (duplicates, unknown ranges, foreign owners), `TestPackageStructure` (errors only in `errors.go`) | Enforced |
| 12 | return ≠ log; log once at boundaries; `errors.Is/As`; no internal leaks | error-model.md boundary table; `runtime.App` and services return errors without logging | errorlint, nilerr; `errmap` tests prove internal text never reaches clients | Enforced / Reviewed |
| 13 | HTTP status separate from business code; business knows no HTTP | `errmap.StatusOf(kind)`; business packages cannot import `net/http` | depguard + `businessStdlibDeny` in archtest; `errmap` tests | Enforced |
| 14 | One validation pipeline; transport vs business validation | Huma tags on `*Input` → 422 `COMMON_VALIDATION_FAILED` with `data.errors`; invariants in services | `errmap` and handler tests | Enforced |
| 15 | One pagination contract, documented exceptions | `httpapi.PageQuery` + `response.NewPage/MapPage`; extras through `<thing>PageMetaDTO`; unpaginated owner-scoped collections listed in api-contract.md | review for new lists | Reviewed |
| 16 | Context first, propagated, never replaced in request paths | — | contextcheck, `archtest.TestRequestPathsKeepTheirContext` (one allow-listed site with reason) | Enforced |
| 17 | Structured logs, fixed fields, no `fmt.Println`, redaction | `platform/logger` (JSON, `request_id`/`trace_id`/`span_id`/`user_id`, redaction of password/secret/token/cookie/authorization/credential/api key) | forbidigo, `TestLoggersComeFromThePlatform`, logger redaction tests | Enforced |
| 18 | Unified tracing and metrics naming | OpenTelemetry for HTTP, pgx, Redis, River, outbound HTTP (ADR 0008); metric naming rules in observability.md | telemetry wiring tests | Tracing Enforced; metrics exporter **Deferred**: the APM ingests traces and logs only; add the exporter in `platform/telemetry` when it gains a metrics endpoint (ADR 0008) |
| 19 | Request ID: trusted upstream or generated; in logs, responses, errors | `middleware.RequestContext` accepts a well-formed upstream id only from trusted proxies; envelope and error bodies carry `requestId`; logger adds it | `requestid`, `clientinfo`, `errmap`, `httpapi` tests | Enforced |
| 20 | Authentication in transport, business permission in services, typed principal | `httpapi.Route.Access` + middleware authenticate; ownership and role rules in services; `actor.Actor` with an unexported context key | handler and service tests per authorization path | Enforced |
| 21 | One data-access approach | ent + pgx pool; raw SQL only in Postgres adapters for what ent cannot express (ADR 0003) | depguard, `TestRawSQLStaysInPostgresAdapters` | Enforced |
| 22 | Transactions decided by services, implemented by infrastructure | `Transactor` ports, `postgres.NewTransactor`, adapters join via `postgres.Client(ctx, client)`, `AfterCommit` hooks | transactor tests in `internal/adapter/postgres`, contract tests | Enforced |
| 23 | Vendors behind adapters and minimal ports | every vendor in `internal/adapter/<vendor>`; ports in consumers; AI providers are reached only through the AI gateway (`ai.Upstream` implemented by `internal/adapter/llm`, ADR 0010) | depguard (business may not import vendor SDKs) | Enforced |
| 24 | Typed, validated, immutable config; no `os.Getenv` | `platform/config` parsed once and validated; compose env block generated | forbidigo, `devtool deploy check` | Enforced |
| 25 | Lifecycle and graceful shutdown order | `runtime.App` (signal → cancel → runners stop → closers in reverse under `SHUTDOWN_TIMEOUT`); HTTP server drains in-flight requests | `runtime` and `server` tests | Enforced |
| 26 | Every goroutine owned; race tests | goroutines only in `internal/platform` | `TestGoroutinesHaveOwners`; CI `go test -race ./...` with Postgres and Redis | Enforced |
| 27 | Bounded retries at one owner | River retries jobs with backoff; one adapter-level retry (Hikarinagi token refresh on 401); services and repositories never retry | references/runtime.md; review | Reviewed |
| 28 | Deadlines on all I/O | `httpclient` (15 s default, header/TLS timeouts), DB `statement_timeout`, Redis dial/read/write timeouts, server read/write/idle timeouts, task and worker timeouts | `httpclient`, `database`, `jobs` tests | Enforced |
| 29 | Explicit idempotency strategy | api-contract.md "Idempotency" (safe reads, idempotent PUT/DELETE, unique constraints for creates, verified webhooks, re-runnable jobs, unique scheduled tasks) | review | Reviewed |
| 30 | Uniform serialization | `platform/jsoncodec` for every JSON body and pushed event: snake_case payloads, legacy camelCase envelope/pagination, `…sssZ` UTC times, big counters as strings | `jsoncodec`, `push`, handler tests | Enforced |
| 31 | Transport and storage shapes do not leak into the domain | business types carry no tags; DTOs in `response*.go`; adapter records in `mapping.go`/adapter files | `archtest.TestBusinessTypesCarryNoTags` (job args and the Lexical format package excepted with reasons) | Enforced |
| 32 | One vocabulary, glossary | `docs/glossary.md`; role-based type names | banned suffixes and file/type naming in `TestPackageStructure` | Enforced |
| 33 | Unit, service, contract, integration, transport, architecture tests | testing.md levels; every package has tests; test files mirror sources | `TestEveryPackageHasTests`, `TestTestFilesMirrorSourceFiles`, CI with `REQUIRE_INTEGRATION=1` | Enforced |
| 34 | Fakes over mocks | `<capability>test` memory fakes run through the same contract suites as the real adapters | depguard `fakes` rule denies gomock, uber mock, testify/mock and mockery in all files including tests | Enforced |
| 35 | Golden path | `internal/favorite` + `favoritepg` + `favoritehttp` (model, ports, service, transaction, errors, validation, contract and HTTP tests, wiring) | SKILL MUST | Enforced by workflow |
| 36 | Scaffolding of the approved structure only | `devtool feature create <name> <range>` writes model, errors, ports, service + test, fakes + contract, ent schema, pg repository + mapping + test, handler/request/response; registers the range; runs entgen | `cmd/devtool` scaffold tests; output passes archtest | Enforced |
| 37 | Agent workflow | SKILL.md "Workflow for every change"; AGENTS.md | — | Reviewed |
| 38 | Minimum coherent change | SKILL workflow step 4 | — | Reviewed |
| 39 | Migration mapping without mechanical translation | recipes/migrate-module.md mapping table; migration.md strategy | — | Reviewed |
| 40 | Compatibility checklist and golden tests | migration.md per-module checklist and intentional deviations; legacy Playwright suite runs against the Go API (`pnpm test:e2e:go`) | e2e suite | Enforced |
| 41 | Pinned, high-signal linters | golangci-lint v2.14.0 pinned in CI: govet, staticcheck, errcheck, ineffassign, unused, contextcheck, gosec, bodyclose, errorlint, nilerr, copyloopvar, rowserrcheck, sqlclosecheck, noctx, depguard, forbidigo, misspell, unconvert, wastedassign | CI | Enforced |
| 42 | Architecture import guard that fails CI | depguard + `internal/archtest` | CI | Enforced |
| 43 | Dependency policy | ADR 0001 dependency policy; checklist item | `go mod tidy` check; review | Reviewed |
| 44 | Generated code marked, untouched, reproducible, checked for staleness | ent files carry `Code generated … DO NOT EDIT`; `business-codes.md` header; `openapi.json` `info.x-generated-by` | `verify.sh` regenerates ent, business codes and OpenAPI and fails on diff; AGENTS.md forbids hand edits | Enforced |
| 45 | One formatter | gofmt + goimports (local prefix) as golangci formatters | `verify.sh`, CI | Enforced |
| 46 | CI gate | `verify.sh`: gofmt, tidy, generated code, vet, golangci-lint, business codes, deploy env, tests (incl. archtest and integration), migration drift; separate race and govulncheck (pinned v1.8.0) jobs | `.github/workflows/api.yml` | Enforced |
| 47 | Single API schema source | OpenAPI generated from route registrations | stale check in `verify.sh` | Enforced; client type generation **Deferred** until the new `@hina-ui/react` frontend starts |
| 48 | Platform contract | `internal/platform/{config,logger,telemetry,database,redis,jobs,cache,ratelimit,realtime,i18n,jsoncodec,httpclient,runtime,server,requestid}`; transport infrastructure for response, errors, validation, authentication | depguard and archtest keep capabilities from re-implementing them | Enforced (metrics: see §18) |
| 49 | ADRs with Context/Decision/Alternatives/Consequences/Migration | `docs/adr/0001`–`0010` | review | Reviewed |
| 50 | Skill structure | `.claude/skills/go-backend/{SKILL.md,references,recipes,scripts}` (Claude Code skill path); the golden path replaces an `examples/` copy so examples cannot drift | — | Done |
| 51 | SKILL.md content | principles, dependency direction, MUST/MUST NOT, workflow, golden path pointer, verification, references, "Where things go" | — | Done |
| 52 | Decidable rules | rules are phrased as MUST/MUST NOT and the decidable ones are archtest or lint checks | this table | Done |
| 53 | Review checklist (14 questions) | `docs/review-checklist.md` covers all 14 plus layout, tags, SQL, pagination/timeouts/retries and test mirroring | — | Done |
| 54 | Security baseline | input validation (Huma), output encoding (jsoncodec, HTML sanitizer for Lexical), parameterized SQL, secrets from config only, auth boundary, log redaction, no SSRF surfaces (presigned URLs must be https, no user-chosen hosts), outbound timeouts, body limits (1 MiB default, per-route `MaxBodyBytes`), upload limits, panic recovery middleware, govulncheck | tests per item; gosec; govulncheck | Enforced |
| 55 | Performance baseline | one DB pool and Redis client per process; bounded worker queues; timeouts on external calls; pagination or documented bounds; reflection only at route registration | review | Reviewed |
| 56 | Documentation set consistent with the skill | `docs/{architecture,error-model,api-contract,observability,migration,glossary,deployment,review-checklist,business-codes,spec-compliance}.md`, `docs/adr/` | review | Done |
| 57 | Things not to do | no empty layers, `BaseService`, `GenericRepository[T]`, `Result[T]`, locator, context DI, `models`/`interfaces` packages, god packages, mutable singletons, DI framework; generics limited to value containers (`response.Page`, `response.Output`, `patch.Clearable`) and small slice/pointer helpers; shared value types live once in libraries (`paging.Page`, `patch.Clearable`) instead of per capability | banned names (archtest), review | Enforced / Reviewed |
| 58 | Priority order | SKILL.md first line | — | Done |
| 59 | Questions answerable from repo + skill + golden path + CI | SKILL.md "Where things go" answers all 21 | — | Done |
| 60–62 | Execution and final verification | `verify.sh` with Postgres, Redis and migration drift, `go test -race ./...`, legacy Playwright suite against the Go API | CI | Enforced |

## Open items

| Item | Reason | Trigger |
|---|---|---|
| Metrics exporter | the APM has no metrics ingest | APM metrics endpoint, or a decision to run a Prometheus scrape target (new ADR) |
| Generated frontend client | the new frontend waits for `@hina-ui/react` | start of the frontend rewrite |
