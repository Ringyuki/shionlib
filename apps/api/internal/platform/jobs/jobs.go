package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
	"github.com/riverqueue/river/rivertype"
	"github.com/riverqueue/rivercontrib/otelriver"
	"github.com/robfig/cron/v3"
)

const scheduledTaskKind = "scheduled_task"

type Task struct {
	Name     string
	Schedule string
	Timeout  time.Duration
	Run      func(ctx context.Context) error
}

type scheduledTask struct {
	Name string `json:"name"`
}

func (scheduledTask) Kind() string {
	return scheduledTaskKind
}

type Options struct {
	Pool     *pgxpool.Pool
	Logger   *slog.Logger
	Timezone *time.Location
	Queues   map[string]int
	Register []func(workers *river.Workers)
	Tasks    []Task
	Process  bool
}

type Runner struct {
	client  *river.Client[pgx.Tx]
	process bool
	logger  *slog.Logger
}

func New(opts Options) (*Runner, error) {
	config := &river.Config{Logger: opts.Logger, Middleware: []rivertype.Middleware{otelriver.NewMiddleware(nil)}}
	if opts.Process {
		workers := river.NewWorkers()
		for _, register := range opts.Register {
			register(workers)
		}
		tasks := make(map[string]Task, len(opts.Tasks))
		periodic := make([]*river.PeriodicJob, 0, len(opts.Tasks))
		parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)
		for _, task := range opts.Tasks {
			if _, exists := tasks[task.Name]; exists {
				return nil, fmt.Errorf("scheduled task %q registered twice", task.Name)
			}
			schedule, err := parser.Parse(task.Schedule)
			if err != nil {
				return nil, fmt.Errorf("scheduled task %q: %w", task.Name, err)
			}
			tasks[task.Name] = task
			periodic = append(periodic, river.NewPeriodicJob(
				zonedSchedule{schedule: schedule, location: opts.Timezone},
				func() (river.JobArgs, *river.InsertOpts) {
					return scheduledTask{Name: task.Name}, &river.InsertOpts{
						MaxAttempts: 1,
						UniqueOpts: river.UniqueOpts{
							ByArgs:  true,
							ByState: []rivertype.JobState{rivertype.JobStateAvailable, rivertype.JobStatePending, rivertype.JobStateRunning, rivertype.JobStateScheduled},
						},
					}
				},
				&river.PeriodicJobOpts{ID: task.Name},
			))
		}
		river.AddWorker(workers, &taskWorker{tasks: tasks, logger: opts.Logger})
		queues := map[string]river.QueueConfig{river.QueueDefault: {MaxWorkers: 10}}
		for name, max := range opts.Queues {
			queues[name] = river.QueueConfig{MaxWorkers: max}
		}
		config.Workers = workers
		config.Queues = queues
		config.PeriodicJobs = periodic
		config.ErrorHandler = errorHandler{logger: opts.Logger}
	}
	client, err := river.NewClient(riverpgxv5.New(opts.Pool), config)
	if err != nil {
		return nil, fmt.Errorf("create job client: %w", err)
	}
	return &Runner{client: client, process: opts.Process, logger: opts.Logger}, nil
}

func (r *Runner) Client() *river.Client[pgx.Tx] {
	return r.client
}

func (r *Runner) Run(ctx context.Context) error {
	if !r.process {
		<-ctx.Done()
		return nil
	}
	if err := r.client.Start(ctx); err != nil {
		return fmt.Errorf("start job client: %w", err)
	}
	<-ctx.Done()
	stopCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
	defer cancel()
	if err := r.client.Stop(stopCtx); err != nil && !errors.Is(err, context.Canceled) {
		return fmt.Errorf("stop job client: %w", err)
	}
	return nil
}

func NewInserter(pool *pgxpool.Pool, logger *slog.Logger) (*river.Client[pgx.Tx], error) {
	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Logger: logger, Middleware: []rivertype.Middleware{otelriver.NewMiddleware(nil)}})
	if err != nil {
		return nil, fmt.Errorf("create job inserter: %w", err)
	}
	return client, nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	migrator, err := rivermigrate.New(riverpgxv5.New(pool), nil)
	if err != nil {
		return fmt.Errorf("create job migrator: %w", err)
	}
	if _, err := migrator.Migrate(ctx, rivermigrate.DirectionUp, nil); err != nil {
		return fmt.Errorf("migrate job tables: %w", err)
	}
	return nil
}

type zonedSchedule struct {
	schedule cron.Schedule
	location *time.Location
}

func (z zonedSchedule) Next(current time.Time) time.Time {
	if z.location == nil {
		return z.schedule.Next(current)
	}
	return z.schedule.Next(current.In(z.location)).UTC()
}

type taskWorker struct {
	river.WorkerDefaults[scheduledTask]
	tasks  map[string]Task
	logger *slog.Logger
}

func (w *taskWorker) Work(ctx context.Context, job *river.Job[scheduledTask]) error {
	task, ok := w.tasks[job.Args.Name]
	if !ok {
		return river.JobCancel(fmt.Errorf("scheduled task %q is not registered", job.Args.Name))
	}
	if task.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, task.Timeout)
		defer cancel()
	}
	start := time.Now()
	if err := task.Run(ctx); err != nil {
		return fmt.Errorf("scheduled task %s: %w", task.Name, err)
	}
	w.logger.InfoContext(ctx, "scheduled task finished", slog.String("task", task.Name), slog.Int64("duration_ms", time.Since(start).Milliseconds()))
	return nil
}

func (w *taskWorker) Timeout(job *river.Job[scheduledTask]) time.Duration {
	if task, ok := w.tasks[job.Args.Name]; ok && task.Timeout > 0 {
		return task.Timeout
	}
	return 0
}

type errorHandler struct {
	logger *slog.Logger
}

func (h errorHandler) HandleError(ctx context.Context, job *rivertype.JobRow, err error) *river.ErrorHandlerResult {
	h.logger.ErrorContext(ctx, "job failed",
		slog.String("kind", job.Kind),
		slog.Int64("job_id", job.ID),
		slog.Int("attempt", job.Attempt),
		slog.Any("error", err),
	)
	return nil
}

func (h errorHandler) HandlePanic(ctx context.Context, job *rivertype.JobRow, panicVal any, trace string) *river.ErrorHandlerResult {
	h.logger.ErrorContext(ctx, "job panicked",
		slog.String("kind", job.Kind),
		slog.Int64("job_id", job.ID),
		slog.Any("panic", panicVal),
		slog.String("stack", trace),
	)
	return nil
}
