package reportjobs

import (
	"context"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/report"
)

type AlertWorker struct {
	river.WorkerDefaults[report.AlertAdmins]
	service *report.Service
}

func NewAlertWorker(service *report.Service) *AlertWorker {
	return &AlertWorker{service: service}
}

func (w *AlertWorker) Work(ctx context.Context, job *river.Job[report.AlertAdmins]) error {
	return w.service.AlertAdmins(ctx, job.Args.ReportID)
}
