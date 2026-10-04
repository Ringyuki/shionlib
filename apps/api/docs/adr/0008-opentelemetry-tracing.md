# ADR 0008: OpenTelemetry tracing exported over OTLP

## Context
The legacy backend had access logs only. The Go backend runs an API and a worker process that call Postgres, Redis, River and several external services; correlating a slow request or a failing job across these needs traces. Shionlib does not run a tracing backend of its own, and the choice of one should not be baked into the code.

## Decision
Use the OpenTelemetry Go SDK, configured once in `internal/platform/telemetry` and exported over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` + `/v1/traces` with the headers in `OTEL_EXPORTER_OTLP_HEADERS`, parent-based trace-id ratio sampling at `OTEL_TRACES_SAMPLER_ARG`. The variables keep their OpenTelemetry meaning so any OTLP backend (Grafana Tempo, Jaeger, SigNoz, a hosted service) works without code changes; they are read through `internal/platform/config` like every other setting. Instrumentation is automatic at the platform and transport edges: HTTP server spans named by route pattern, `otelhttp` on every client from `platform/httpclient`, `otelpgx` on the pgx pool, `redisotel` on the Redis client and `otelriver` on River clients. Log lines inside a span carry `trace_id` and `span_id`. Without `OTEL_EXPORTER_OTLP_ENDPOINT` the global provider stays a no-op.

## Alternatives
A vendor agent or SDK (lock-in to one backend); hand-written spans per capability (inconsistent coverage); Prometheus metrics only (no request-level correlation).

## Consequences
New dependencies: the OTel SDK, OTLP HTTP exporter and the four instrumentation libraries. Business packages stay free of tracing types. Export is off until a backend is chosen. Metrics are not exported; adding an exporter is a separate decision once the backend is known.

## Migration
None for data. To turn tracing on, operators set `OTEL_EXPORTER_OTLP_ENDPOINT` (and `OTEL_EXPORTER_OTLP_HEADERS` when the backend needs credentials) in the Dokploy environment; the worker reports as `shionlib-worker`.
