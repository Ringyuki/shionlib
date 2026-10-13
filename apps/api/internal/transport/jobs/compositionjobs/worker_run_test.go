package compositionjobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/compositionjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

type env struct {
	repo   *compositiontest.MemoryRepository
	events *compositiontest.Recorder
	stage  *compositiontest.Stage
	runs   *composition.RunService
	reads  *composition.ReadService
}

func newEnv() env {
	now := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	e := env{repo: compositiontest.NewMemoryRepository(func() time.Time { return now }), events: &compositiontest.Recorder{}, stage: compositiontest.NewStage()}
	deps := composition.Deps{
		Repo: e.repo, Stage: e.stage, Messages: e.events, Queue: e.events, Tx: &txtest.Immediate{}, Settings: settingtest.Source{}, Now: func() time.Time { return now },
		Examiner: &compositiontest.Examiner{}, Patches: &compositiontest.Patches{},
	}
	notices := composition.NewNoticeService(e.events)
	e.runs = composition.NewRunService(deps, notices)
	e.reads = composition.NewReadService(composition.NewService(deps), deps.Examiner, deps.Patches, notices)
	return e
}

func (e env) seeded(t *testing.T, state composition.State) composition.Composition {
	t.Helper()
	ctx := context.Background()
	created, err := e.repo.Create(ctx, composition.NewComposition{GameID: 10, CreatorID: 1})
	if err != nil {
		t.Fatal(err)
	}
	created.State = state
	if err := e.repo.Save(ctx, created); err != nil {
		t.Fatal(err)
	}
	return created
}

func runJob(id, attempt int) *river.Job[composition.Run] {
	return &river.Job[composition.Run]{JobRow: &rivertype.JobRow{Attempt: attempt, MaxAttempts: 5}, Args: composition.Run{CompositionID: id}}
}

func TestRunWorkerWaitsForASlotAndStopsACompositionThatCannotGoOn(t *testing.T) {
	ctx := context.Background()
	e := newEnv()
	compositionjobs.Register(e.reads, e.runs)(river.NewWorkers())
	worker := compositionjobs.NewRunWorker(e.runs)
	if worker.Timeout(runJob(1, 1)) < 6*time.Hour {
		t.Fatal("packing a large game needs a long timeout")
	}
	if next := worker.NextRetry(runJob(1, 3)); time.Until(next) < 3*time.Minute || time.Until(next) > 5*time.Minute {
		t.Fatalf("the wait doubles with each attempt: %s", time.Until(next))
	}

	e.seeded(t, composition.StateRunning)
	waiting := e.seeded(t, composition.StateQueued)
	var snooze *river.JobSnoozeError
	if err := worker.Work(ctx, runJob(waiting.ID, 1)); !errors.As(err, &snooze) {
		t.Fatalf("while every slot is taken the job is put off: %v", err)
	}

	alone := newEnv()
	stuck := alone.seeded(t, composition.StateQueued)
	worker = compositionjobs.NewRunWorker(alone.runs)
	if err := worker.Work(ctx, runJob(stuck.ID, 1)); err != nil {
		t.Fatalf("a composition without a plan is stopped, which is no failure of the worker: %v", err)
	}
	if stopped, _ := alone.repo.Get(ctx, stuck.ID); stopped.State != composition.StateFailed || len(alone.events.Messages()) != 1 {
		t.Fatalf("stopped: %+v", stopped)
	}
	if err := worker.Work(ctx, runJob(999, 1)); err != nil {
		t.Fatalf("a composition that is gone: %v", err)
	}
}

func TestReadWorkerReadsTheInputItIsGiven(t *testing.T) {
	e := newEnv()
	worker := compositionjobs.NewReadWorker(e.reads)
	job := &river.Job[composition.Read]{JobRow: &rivertype.JobRow{Attempt: 1}, Args: composition.Read{CompositionID: 999, Role: composition.RolePatch}}
	if err := worker.Work(context.Background(), job); err != nil {
		t.Fatalf("an input of a composition that is gone: %v", err)
	}
	if worker.Timeout(job) < 10*time.Minute || time.Until(worker.NextRetry(job)) > 2*time.Minute {
		t.Fatal("reading a large patch needs time, and a first retry comes soon")
	}
	tasks := compositionjobs.Tasks(composition.NewCleanService(composition.NewService(composition.Deps{})))
	if len(tasks) != 1 || tasks[0].Name != "composition_clean" || tasks[0].Run == nil || tasks[0].Schedule == "" {
		t.Fatalf("tasks: %+v", tasks)
	}
}
