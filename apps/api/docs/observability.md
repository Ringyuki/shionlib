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

## Metrics and traces

Request metrics come from the access log today. OpenTelemetry tracing and metrics are planned behind `OTEL_EXPORTER_OTLP_ENDPOINT`; instrumentation will live in `internal/platform` so capabilities need no changes.
