# Runtime rules

## Configuration

- All settings are fields in `internal/platform/config.Config`, parsed once at startup with `caarlos0/env`, validated in `Validate()`, then passed by value or pointer into constructors. Empty env values fall back to defaults.
- Add a setting: field with `env:"NAME" envDefault:"..."`, validation, `.env.example` entry, and the passthrough line in the `x-api-environment` block of `infra/compose.app.yml` (`go run ./cmd/devtool deploy env` prints it; `devtool deploy check` in verify.sh fails when they disagree).
- Secrets are never logged (`logger` redacts keys containing password, secret, token, cookie, authorization, credential, api_key).

## Context

- First parameter of every method that does I/O. Carry request id, locale, actor, stale-token signal and trace data only.
- Detached work uses `context.WithoutCancel(ctx)` deliberately; never `context.Background()` inside a request path.

## Concurrency

- Long-running components implement `runtime.Runner` (`Run(ctx) error`) and are registered with `runtime.App`; closers run in reverse order on shutdown.
- Fan-out inside a request uses `errgroup.WithContext` with a bounded `SetLimit`.
- Background work goes through River jobs, not `go func()`.

## Jobs

- Job args are plain structs in the business package with `Kind() string` and JSON tags. Business code enqueues through a port (`Enqueue(ctx, job) error`) implemented by `internal/adapter/queue`.
- Workers live in `internal/transport/jobs/<capability>jobs`, call one service method, and return errors (River retries with backoff). They do not log errors themselves.
- Scheduled tasks are `jobs.Task{Name, Schedule (cron, SCHEDULE_TIMEZONE), Timeout, Run}` added to `Modules.Jobs.Tasks`; they are leader-elected and never overlap.

## Cache

- Cache is an optimization, never a source of truth. Use the `Cache` port (`Get(ctx, key, dst)`, `Set(ctx, key, value, ttl)`, `Delete`, `DeletePrefix`) implemented by `internal/platform/cache`. Keys are `<capability>:<entity>:<id>:...` and every write path invalidates what it changes.

## Outbound HTTP

- Use an `*http.Client` from `platform/httpclient.New` with an explicit timeout, injected into the adapter. Retries live in exactly one place (the adapter) with bounded attempts, backoff and jitter, and only for idempotent requests.
- Vendor SDKs and URLs never appear in business packages; business defines the port.

## Observability

- Logging: `*slog.Logger` injected; JSON in production. Fields: `request_id`, `trace_id`, `span_id`, `user_id`, `method`, `route`, `status`, `duration_ms`, `business_code`, `error`. `trace_id`/`span_id` are added automatically inside traced requests and jobs.
- Business code logs only meaningful business events at Info. Errors are logged at boundaries only.
- Tracing is OpenTelemetry, set up once in `internal/platform/telemetry` and exported to `APM_ENDPOINT`. HTTP server spans, outbound `platform/httpclient` calls, pgx queries, Redis commands and River jobs are instrumented automatically; do not wrap them again.
- Business spans: only around a unit of work that is not already a request, job or query and is worth seeing on its own (for example one catalog import step). Use `telemetry.Tracer().Start(ctx, "<capability>.<operation>")`, end it with `defer span.End()`, record failures with `span.RecordError(err)`. Business packages receive no tracer; spans are started in adapters or transport.
- Metrics: the APM derives request, query and job rates and durations from spans. New metrics MUST use OpenTelemetry semantic-convention names (`http.server.request.duration`, `db.client.operation.duration`, `messaging.process.duration`) or `shionlib.<capability>.<measure>` with a unit suffix in the description, and live in `internal/platform/telemetry`, never ad hoc in business code.

## Security baseline

- Inputs are validated at the transport boundary; SQL uses parameters only; outbound URLs to user-controlled hosts are forbidden (no SSRF surfaces) unless an allow-list is reviewed.
- Body size limits: Huma default 1 MiB per operation; raise per route with `MaxBodyBytes` only where required (uploads).
- Client IPs come from `clientinfo` (trusted proxies only). Tokens, cookies and passwords never reach logs.
- Crypto and auth primitives come from vetted libraries in adapters (`golang-jwt`, `x/crypto/argon2`, `go-webauthn`); business code never implements them.
