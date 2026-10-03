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

OpenTelemetry traces are exported over OTLP/HTTP to `APM_ENDPOINT` + `/v1/traces` (the Hikarinagi APM ingest) with `Authorization: Bearer $APM_INGEST_KEY`. Unset `APM_ENDPOINT` disables export; instrumentation then runs against a no-op provider.

- Sampling: parent-based, `APM_SAMPLE_RATE` of new root traces (0..1, default 1). Incoming `traceparent` headers are honoured.
- Resource: `service.name` = `APP_NAME` (`shionlib-api`; the worker runs as `shionlib-worker`), `service.version` = `APP_VERSION`, `deployment.environment` = `APP_ENV`.
- Spans: one server span per HTTP request named `<METHOD> <route pattern>` with `http.route`, `http.response.status_code` and `shionlib.request_id` (health paths are not traced); outbound HTTP clients from `internal/platform/httpclient`; every pgx query; Redis commands; River job insert and work.
- Logs: lines written inside a traced request or job carry `trace_id` and `span_id`.

Metrics still come from the access log.
