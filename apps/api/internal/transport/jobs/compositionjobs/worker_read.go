package compositionjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

const (
	readTimeout   = time.Hour
	runTimeout    = 12 * time.Hour
	slotWait      = 30 * time.Second
	firstRetry    = time.Minute
	maxRetryDelay = time.Hour
)

func NewReadWorker(reads *composition.ReadService) *ReadWorker {
	return &ReadWorker{reads: reads}
}

type ReadWorker struct {
	river.WorkerDefaults[composition.Read]
	reads *composition.ReadService
}

func (w *ReadWorker) Work(ctx context.Context, job *river.Job[composition.Read]) error {
	return w.reads.Read(ctx, job.Args)
}

func (w *ReadWorker) Timeout(*river.Job[composition.Read]) time.Duration {
	return readTimeout
}

func (w *ReadWorker) NextRetry(job *river.Job[composition.Read]) time.Time {
	return time.Now().Add(backoff(job.Attempt))
}

func backoff(attempt int) time.Duration {
	delay := firstRetry
	for i := 1; i < attempt && delay < maxRetryDelay; i++ {
		delay *= 2
	}
	return min(delay, maxRetryDelay)
}
