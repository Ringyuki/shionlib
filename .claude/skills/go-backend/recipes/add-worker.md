# Add background work

Queued job:
1. Define the args struct in the business package: `type ModerateComment struct { CommentID int ` + "`json:\"comment_id\"`" + ` }` with `func (ModerateComment) Kind() string { return "moderate_comment" }`.
2. Business code enqueues through its `Queue` port (`Enqueue(ctx, job) error`), after the transaction commits.
3. Implement the worker in `internal/transport/jobs/<capability>jobs` embedding `river.WorkerDefaults[Args]`; `Work` calls one service method and returns its error.
4. Register it in `Modules.Jobs.Register` and give it a queue in `Modules.Jobs.Queues` if it needs its own concurrency.

Scheduled task:
1. Expose a service method `func (s *Service) CleanupX(ctx context.Context) error` that is idempotent and bounded.
2. Append `jobs.Task{Name: "<capability>_<action>", Schedule: "0 3 * * *", Timeout: 10 * time.Minute, Run: svc.CleanupX}` to `Modules.Jobs.Tasks`.
