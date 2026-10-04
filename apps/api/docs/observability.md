# Observability

## Logs

- JSON lines on stdout (`LOG_FORMAT=json`), level from `LOG_LEVEL`.
- Every line has `service`, `version`; request-scoped lines add `request_id` and, when known, `user_id`.
- One access line per HTTP request: `method`, `route` (pattern, not raw path), `status`, `duration_ms`, `ip`, `business_code`, `error` (5xx only). 4xx are `WARN` except 401; 5xx are `ERROR`; `/health` is `DEBUG`.
- Jobs log start/finish of scheduled tasks and every failure once (`kind`, `job_id`, `attempt`, `error`).
- Sensitive keys are redacted by the logger.

## Health

- `GET /health/live`: process is up (container liveness).
- `GET /health`: database and Redis reachable (readiness); 503 when any check fails.

## Traces

OpenTelemetry traces are exported over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` + `/v1/traces`, so any OTLP backend can receive them. `OTEL_EXPORTER_OTLP_HEADERS` adds request headers in the OpenTelemetry format (`name=value` pairs separated by commas, values percent-encoded, e.g. `Authorization=Bearer%20<token>`). Unset `OTEL_EXPORTER_OTLP_ENDPOINT` disables export; instrumentation then runs against a no-op provider.

- Sampling: parent-based trace-id ratio, `OTEL_TRACES_SAMPLER_ARG` of new root traces (0..1, default 1). Incoming `traceparent` headers are honoured.
- Resource: `service.name` = `APP_NAME` (`shionlib-api`; the worker runs as `shionlib-worker`), `service.version` = `APP_VERSION`, `deployment.environment` = `APP_ENV`.
- Spans: one server span per HTTP request named `<METHOD> <route pattern>` with `http.route`, `http.response.status_code` and `shionlib.request_id` (health paths are not traced); outbound HTTP clients from `internal/platform/httpclient`; every pgx query; Redis commands; River job insert and work.
- Logs: lines written inside a traced request or job carry `trace_id` and `span_id`.

## Metrics

There is no metrics exporter yet; it waits for the choice of a monitoring backend (ADR 0008). Request, query and job rates and durations are derived from spans and from the access log (`duration_ms`, `status`, `route`).

When an exporter is added (future action, recorded in ADR 0008):

- instruments are created only in `internal/platform/telemetry`, never in business code;
- names follow the OpenTelemetry semantic conventions (`http.server.request.duration`, `db.client.operation.duration`, `messaging.process.duration`) or `shionlib.<capability>.<measure>` with the unit on the instrument;
- HTTP, pgx, Redis and River metrics come from the same instrumentation libraries that produce the spans, not from hand-written counters.
