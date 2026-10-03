# Architecture

The Go backend in `apps/api` replaces the NestJS backend in `apps/backend`. It keeps the HTTP contract the web client depends on, keeps the PostgreSQL data, and replaces the internal coupling to Hikarinagi with pluggable catalog sources.

## Shape of the system

```text
              ┌──────────────── cmd/api ────────────────┐
              │ serve │ worker │ migrate │ openapi       │
              └───────────────────┬──────────────────────┘
                         internal/bootstrap  (composition root, explicit constructors)
        ┌─────────────────────────┼──────────────────────────────┐
 internal/transport        business capabilities           internal/adapter
 http/<x>http handlers ──► internal/<x> services ◄── postgres/<x>pg, redis/<x>redis,
 jobs/<x>jobs workers      models · ports · errors        queue, jwt, vendors
        └──────────── internal/platform (config, logger, database, redis, jobs, cache, ratelimit, i18n, httpclient, runtime)
                       kernel: internal/apperror · internal/actor
```

- **Business capabilities** own rules, models, errors and the interfaces (ports) they need. They import nothing technical.
- **Adapters** implement ports for PostgreSQL (ent), Redis, River, object storage and vendor APIs, and translate infrastructure failures into business errors.
- **Transport** turns HTTP requests and queued jobs into service calls. It never contains business decisions.
- **Platform** supplies shared runtime infrastructure once, so capabilities never re-implement config, logging, caching or rate limiting.
- **Bootstrap** builds the whole graph with explicit constructors. There is no container and no global state.

Rules are enforced by `internal/archtest`, golangci-lint (depguard, forbidigo) and `cmd/devtool` checks; see `.claude/skills/go-backend` for the full rule set.

## Request lifecycle

1. `middleware.RequestContext`: request id (trusted upstream id or new UUID), client IP from trusted proxies, request state.
2. `middleware.AccessLog` (one structured line per request, includes `business_code` and the error for 5xx) and `middleware.Recover`.
3. CORS, locale (`shionlib_locale` cookie → `lang` query → `Accept-Language` → default `zh`), optional authentication (bearer header, then `shionlib_access_token` cookie).
4. Huma decodes and validates the input, runs the per-operation rate limit and access middleware, then the handler.
5. The handler calls one service method and returns `response.Output`; errors go through `errmap` into the unified envelope.

## Processes

- `shionlib-api serve`: HTTP server; also processes jobs when `WORKERS_ENABLED=true`.
- `shionlib-api worker`: jobs and scheduled tasks only. Scheduled tasks are leader-elected by River, so any number of replicas is safe.
- `shionlib-api migrate up`: applies `migrations/` (adopting a Prisma-managed database on first run) and River's tables.
- `shionlib-api openapi <file>`: writes the OpenAPI 3.1 document from the registered routes without touching the network.

## Golden path

`internal/favorite` with `internal/adapter/postgres/favoritepg` and `internal/transport/http/favoritehttp` is the reference implementation of every convention: ports, errors, transactions, contract tests and HTTP tests.
