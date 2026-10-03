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

func NewStoreWorker(transfers *download.TransferService) *StoreWorker {
	return &StoreWorker{transfers: transfers}
}

type StoreWorker struct {
	river.WorkerDefaults[download.StoreFile]
	transfers *download.TransferService
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

func Backoff(base time.Duration, attempt int) time.Duration {
	delay := base
	for i := 1; i < attempt && delay < maxRetryDelay; i++ {
		delay *= 2
	}
	return min(delay, maxRetryDelay)
}
