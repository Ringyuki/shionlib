# Add background work

Queued job:
1. Declare the args in the capability's `jobs.go`: `type ModerateComment struct { CommentID int ` + "`json:\"comment_id\"`" + ` }` with `func (ModerateComment) Kind() string { return "moderate_comment" }`.
2. Business code enqueues through its `Queue` port (`Enqueue(ctx, job) error`), after the transaction commits.
3. Add `internal/transport/jobs/<capability>jobs/worker_<purpose>.go`: an exported `<Purpose>Worker` embedding `river.WorkerDefaults[Args]`, `New<Purpose>Worker(service)`, and `Work` that calls one service method and returns its error. Add `Timeout`/`NextRetry` only when the defaults are wrong.
4. In the package's `tasks.go`, add the worker to `Register(...) func(*river.Workers)`; bootstrap appends `Register` to `Modules.Jobs.Register` and gives it a queue in `Modules.Jobs.Queues` if it needs its own concurrency.
5. `worker_<purpose>_test.go`: the worker runs the service and returns failures.

Scheduled task:
1. Expose a service method `func (s *Service) CleanupX(ctx context.Context) error` that is idempotent and bounded.
2. Return `jobs.Task{Name: "<capability>_<action>", Schedule: "0 3 * * *", Timeout: 10 * time.Minute, Run: svc.CleanupX}` from the package's `Tasks(...)` in `tasks.go`; bootstrap appends it to `Modules.Jobs.Tasks`.
3. `tasks_test.go`: name, schedule and that `Run` calls the service.
