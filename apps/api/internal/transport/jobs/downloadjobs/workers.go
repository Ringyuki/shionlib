package downloadjobs

import (
	"context"
	"errors"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	storeTimeout   = 6 * time.Hour
	firstRetry     = time.Minute
	maxRetryDelay  = time.Hour
	purgeTimeout   = 10 * time.Minute
	purgeBaseDelay = 30 * time.Second
)

func Register(transfers *download.Transfers) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewStoreWorker(transfers))
		river.AddWorker(workers, NewPurgeWorker(transfers))
	}
}

func NewStoreWorker(transfers *download.Transfers) *StoreWorker {
	return &StoreWorker{transfers: transfers}
}

func NewPurgeWorker(transfers *download.Transfers) *PurgeWorker {
	return &PurgeWorker{transfers: transfers}
}

type StoreWorker struct {
	river.WorkerDefaults[download.StoreFile]
	transfers *download.Transfers
}

func (w *StoreWorker) Work(ctx context.Context, job *river.Job[download.StoreFile]) error {
	err := w.transfers.Store(ctx, job.Args.FileID)
	if errors.Is(err, download.ErrLocalFileMissing) {
		return river.JobCancel(err)
	}
	return err
}

func (w *StoreWorker) Timeout(*river.Job[download.StoreFile]) time.Duration {
	return storeTimeout
}

func (w *StoreWorker) NextRetry(job *river.Job[download.StoreFile]) time.Time {
	return time.Now().Add(Backoff(firstRetry, job.Attempt))
}

type PurgeWorker struct {
	river.WorkerDefaults[download.PurgeObjects]
	transfers *download.Transfers
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

func Backoff(base time.Duration, attempt int) time.Duration {
	delay := base
	for i := 1; i < attempt && delay < maxRetryDelay; i++ {
		delay *= 2
	}
	return min(delay, maxRetryDelay)
}
