package reportjobs

import (
	"context"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/report"
)

func Register(service *report.Service) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, &AlertWorker{service: service})
	}
}

type AlertWorker struct {
	river.WorkerDefaults[report.AlertAdmins]
	service *report.Service
}

func (w *AlertWorker) Work(ctx context.Context, job *river.Job[report.AlertAdmins]) error {
	return w.service.AlertAdmins(ctx, job.Args.ReportID)
}
