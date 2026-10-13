package searchjobs

import (
	"context"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type RecordWorker struct {
	river.WorkerDefaults[search.RecordSearchJob]
	service *search.Service
}

func NewRecordWorker(service *search.Service) *RecordWorker {
	return &RecordWorker{service: service}
}

func (w *RecordWorker) Work(ctx context.Context, job *river.Job[search.RecordSearchJob]) error {
	if err := w.service.RecordSearch(ctx, job.Args.Query); err != nil {
		return river.JobCancel(err)
	}
	return nil
}
