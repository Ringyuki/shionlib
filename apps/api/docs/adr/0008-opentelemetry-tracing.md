# ADR 0008: OpenTelemetry tracing exported to the Hikarinagi APM

## Context
The legacy backend had access logs only. The Go backend runs an API and a worker process that call Postgres, Redis, River and several external services; correlating a slow request or a failing job across these needs traces. Hikarinagi already runs an APM that ingests OTLP/HTTP traces and logs with per-service ingest keys.

## Decision
Use the OpenTelemetry Go SDK, configured once in `internal/platform/telemetry` and exported over OTLP/HTTP to `APM_ENDPOINT` + `/v1/traces` with `Authorization: Bearer APM_INGEST_KEY`, parent-based sampling at `APM_SAMPLE_RATE`. Instrumentation is automatic at the platform and transport edges: HTTP server spans named by route pattern, `otelhttp` on every client from `platform/httpclient`, `otelpgx` on the pgx pool, `redisotel` on the Redis client and `otelriver` on River clients. Log lines inside a span carry `trace_id` and `span_id`. Without `APM_ENDPOINT` the global provider stays a no-op.

## Alternatives
A vendor agent or SDK (lock-in, second protocol next to the existing APM); hand-written spans per capability (inconsistent coverage); Prometheus metrics only (no request-level correlation, and the existing APM does not scrape).

## Consequences
New dependencies: the OTel SDK, OTLP HTTP exporter and the four instrumentation libraries. Business packages stay free of tracing types. Metrics are derived from spans by the APM; a metrics exporter needs its own decision if the APM gains a metrics endpoint.

## Migration
None for data. Operators set `APM_ENDPOINT` and `APM_INGEST_KEY` in the Dokploy environment; the worker reports as `shionlib-worker`.
