package downloadjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func NewRenameWorker(names *download.NameService) *RenameWorker {
	return &RenameWorker{names: names}
}

type RenameWorker struct {
	river.WorkerDefaults[download.RenameFiles]
	names *download.NameService
}

func (w *RenameWorker) Work(ctx context.Context, job *river.Job[download.RenameFiles]) error {
	return w.names.Rename(ctx, job.Args)
}

func (w *RenameWorker) NextRetry(job *river.Job[download.RenameFiles]) time.Time {
	return time.Now().Add(Backoff(firstRetry, job.Attempt))
}
