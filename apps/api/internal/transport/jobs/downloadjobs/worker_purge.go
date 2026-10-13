package downloadjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func NewPurgeWorker(transfers *download.TransferService) *PurgeWorker {
	return &PurgeWorker{transfers: transfers}
}

type PurgeWorker struct {
	river.WorkerDefaults[download.PurgeObjects]
	transfers *download.TransferService
}

func (w *PurgeWorker) Work(ctx context.Context, job *river.Job[download.PurgeObjects]) error {
	return w.transfers.Purge(ctx, job.Args)
}

func (w *PurgeWorker) Timeout(*river.Job[download.PurgeObjects]) time.Duration {
	return purgeTimeout
}

func (w *PurgeWorker) NextRetry(job *river.Job[download.PurgeObjects]) time.Time {
	return time.Now().Add(Backoff(purgeBaseDelay, job.Attempt))
}
