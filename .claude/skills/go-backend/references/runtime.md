# Runtime rules

## Configuration

- All settings are fields in `internal/platform/config.Config`, parsed once at startup with `caarlos0/env`, validated in `Validate()`, then passed by value or pointer into constructors. Empty env values fall back to defaults.
- Add a setting: field with `env:"NAME" envDefault:"..."`, validation, `.env.example` entry, and the passthrough line in the `x-api-environment` block of `infra/compose.app.yml` (`go run ./cmd/devtool deploy env` prints it; `devtool deploy check` in verify.sh fails when they disagree).
- Secrets are never logged (`logger` redacts keys containing password, secret, token, cookie, authorization, credential, api_key).

## Context

- First parameter of every method that does I/O. Carry request id, locale, actor, stale-token signal and trace data only.
- Detached work uses `context.WithoutCancel(ctx)` deliberately; never `context.Background()` inside a request path.

## Concurrency

- Long-running components implement `runtime.Runner` (`Run(ctx) error`) and are registered with `runtime.App`; closers run in reverse order on shutdown under `SHUTDOWN_TIMEOUT`, even after the run context is cancelled. `runtime.App.Start` returns component and close errors without logging them; `cmd/api` reports them once.
- `go` statements are allowed only in `internal/platform` (archtest).
- Fan-out inside a request uses `errgroup.WithContext` with a bounded `SetLimit`.
- Background work goes through River jobs, not `go func()`.

## Jobs

- Job args are plain structs in the capability's `jobs.go` with `Kind() string` and JSON tags (the only business types with tags). Business code enqueues through a port (`Enqueue(ctx, job) error`) implemented by `internal/adapter/queue`.
- Workers are exported `<Purpose>Worker` types in `internal/transport/jobs/<capability>jobs/worker_<purpose>.go` with a `New<Purpose>Worker` constructor; `Work` calls one service method and returns its error (River retries with backoff). They do not log errors themselves; `platform/jobs` logs every failure once.
- `tasks.go` holds `Register(...) func(*river.Workers)` (adds the package's workers) and `Tasks(...) []jobs.Task`; bootstrap appends them to `Modules.Jobs`.
- Scheduled tasks are `jobs.Task{Name, Schedule (cron, SCHEDULE_TIMEZONE), Timeout, Run}` added to `Modules.Jobs.Tasks`; they are leader-elected and never overlap.

## Cache

- Cache is an optimization, never a source of truth. Use the `Cache` port (`Get(ctx, key, dst)`, `Set(ctx, key, value, ttl)`, `Delete`, `DeletePrefix`) implemented by `internal/platform/cache`. Keys are `<capability>:<entity>:<id>:...` and every write path invalidates what it changes.

## Outbound HTTP

- Use an `*http.Client` from `platform/httpclient.New` (15 s default timeout, response-header and TLS timeouts, tracing), injected into the adapter. Retries live in exactly one place: queued work is retried by River (bounded attempts, exponential backoff with jitter); an adapter retries only idempotent calls and only when no job wraps it (`hikarinagi.Client` re-fetches its token once on 401). Services and repositories never retry.
- Vendor SDKs and URLs never appear in business packages; business defines the port.

## Observability

- Logging: `*slog.Logger` injected; JSON in production. Fields: `request_id`, `trace_id`, `span_id`, `user_id`, `method`, `route`, `status`, `duration_ms`, `business_code`, `error`. `trace_id`/`span_id` are added automatically inside traced requests and jobs.
- Business code logs only meaningful business events at Info. Errors are logged at boundaries only.
- Tracing is OpenTelemetry, set up once in `internal/platform/telemetry` and exported over OTLP to `OTEL_EXPORTER_OTLP_ENDPOINT`. HTTP server spans, outbound `platform/httpclient` calls, pgx queries, Redis commands and River jobs are instrumented automatically; do not wrap them again.
- Business spans: only around a unit of work that is not already a request, job or query and is worth seeing on its own (for example one catalog import step). Use `telemetry.Tracer().Start(ctx, "<capability>.<operation>")`, end it with `defer span.End()`, record failures with `span.RecordError(err)`. Business packages receive no tracer; spans are started in adapters or transport.
- Metrics: there is no metrics exporter yet (no monitoring backend is chosen; ADR 0008). Request, query and job rates and durations are derived from spans and from the access log. When an exporter is added, metrics MUST use OpenTelemetry semantic-convention names (`http.server.request.duration`, `db.client.operation.duration`, `messaging.process.duration`) or `shionlib.<capability>.<measure>` with the unit in the instrument, and are created only in `internal/platform/telemetry`, never in business code.

## Security baseline

- Inputs are validated at the transport boundary; SQL uses parameters only; outbound URLs to user-controlled hosts are forbidden (no SSRF surfaces) unless an allow-list is reviewed.
- Body size limits: Huma default 1 MiB per operation; raise per route with `MaxBodyBytes` only where required (uploads).
- Client IPs come from `clientinfo` (trusted proxies only). Tokens, cookies and passwords never reach logs.
- Crypto and auth primitives come from vetted libraries in adapters (`golang-jwt`, `x/crypto/argon2`, `go-webauthn`); business code never implements them.
