package walkthroughjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type FormatWorker struct {
	river.WorkerDefaults[walkthrough.FormatWalkthrough]
	formats *walkthrough.FormatService
}

func NewFormatWorker(formats *walkthrough.FormatService) *FormatWorker {
	return &FormatWorker{formats: formats}
}

func (w *FormatWorker) Work(ctx context.Context, job *river.Job[walkthrough.FormatWalkthrough]) error {
	return w.formats.Run(ctx, job.Args.TaskID)
}

func (w *FormatWorker) Timeout(*river.Job[walkthrough.FormatWalkthrough]) time.Duration {
	return formatTimeout
}
