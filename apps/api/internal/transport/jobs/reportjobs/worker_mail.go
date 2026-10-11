package reportjobs

import (
	"context"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/report"
)

type MailWorker struct {
	river.WorkerDefaults[report.MailAdmins]
	service *report.Service
}

func NewMailWorker(service *report.Service) *MailWorker {
	return &MailWorker{service: service}
}

func (w *MailWorker) Work(ctx context.Context, job *river.Job[report.MailAdmins]) error {
	return w.service.MailAdmins(ctx, job.Args.ReportID)
}
