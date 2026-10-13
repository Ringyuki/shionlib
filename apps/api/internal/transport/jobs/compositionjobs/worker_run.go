package compositionjobs

import (
	"context"
	"errors"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

func NewRunWorker(runs *composition.RunService) *RunWorker {
	return &RunWorker{runs: runs}
}

type RunWorker struct {
	river.WorkerDefaults[composition.Run]
	runs *composition.RunService
}

func (w *RunWorker) Work(ctx context.Context, job *river.Job[composition.Run]) error {
	err := w.runs.Run(ctx, job.Args.CompositionID)
	switch {
	case err == nil:
		return nil
	case errors.Is(err, composition.ErrNoSlot):
		return river.JobSnooze(slotWait)
	case ctx.Err() != nil || job.Attempt < job.MaxAttempts:
		return err
	}
	if abandoned := w.runs.GiveUp(ctx, job.Args.CompositionID, err); abandoned != nil {
		return errors.Join(err, abandoned)
	}
	return river.JobCancel(err)
}

func (w *RunWorker) Timeout(*river.Job[composition.Run]) time.Duration {
	return runTimeout
}

func (w *RunWorker) NextRetry(job *river.Job[composition.Run]) time.Time {
	return time.Now().Add(backoff(job.Attempt))
}
