# ADR 0004: Background work on River

## Context
Bull queues and `@nestjs/schedule` crons ran in every process without locks, so multiple replicas would run every cron.

## Decision
River (Postgres-backed) runs queued jobs and scheduled tasks. Scheduled tasks are periodic River jobs created by the elected leader and made unique while pending or running, so they never overlap. Job args are plain structs in business packages; workers live in `internal/transport/jobs`.

## Alternatives
asynq on Redis (no transactional durability, separate scheduler locking); in-process cron with Postgres advisory locks (reinvents retries and observability).

## Consequences
River tables live in the application database and are migrated by `migrate up`. Jobs are enqueued after the business transaction commits; periodic sweepers recover anything missed.

## Migration
Bull queues and Nest crons are dropped with the legacy backend; there is no in-flight job hand-off. `shionlib-api migrate up` creates River's tables. Work that was queued in Bull at cutover is recovered from database state by sweepers: `file_scan_pending` scans files still waiting for a scan, `download_store_requeue` queues approved files that never reached object storage, and `moderation_requeue_stale_reviews` re-screens pending comments and walkthrough reviews. Admin alert emails queued in Bull at cutover are lost; the in-app messages already exist.
