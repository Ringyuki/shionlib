package catalogjobs

import (
	"context"
	"errors"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

const (
	importTimeout   = 2 * time.Minute
	rateLimitPause  = time.Minute
	refreshTimeout  = 5 * time.Minute
	changesTimeout  = 9 * time.Minute
	refreshSchedule = "*/10 * * * *"
	changesSchedule = "*/10 * * * *"
)

type Importer interface {
	Import(ctx context.Context, ref catalog.Ref) (int, error)
}

type ImportWorker struct {
	river.WorkerDefaults[catalog.ImportJob]
	importer Importer
}

func NewImportWorker(importer Importer) *ImportWorker {
	return &ImportWorker{importer: importer}
}

func (w *ImportWorker) Register(workers *river.Workers) {
	river.AddWorker(workers, w)
}

func (w *ImportWorker) Timeout(*river.Job[catalog.ImportJob]) time.Duration {
	return importTimeout
}

func (w *ImportWorker) Work(ctx context.Context, job *river.Job[catalog.ImportJob]) error {
	_, err := w.importer.Import(ctx, catalog.Ref(job.Args))
	switch {
	case err == nil, errors.Is(err, catalog.ErrEntryNotFound):
		return nil
	case errors.Is(err, catalog.ErrUnknownSource):
		return river.JobCancel(err)
	case errors.Is(err, catalog.ErrRateLimited):
		return river.JobSnooze(rateLimitPause)
	default:
		return err
	}
}
