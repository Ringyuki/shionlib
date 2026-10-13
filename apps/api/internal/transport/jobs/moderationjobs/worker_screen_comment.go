package moderationjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

const (
	screeningTimeout = time.Minute
	reviewTimeout    = 5 * time.Minute
)

type ScreenCommentWorker struct {
	river.WorkerDefaults[moderation.ScreenComment]
	service *moderation.Service
}

func NewScreenCommentWorker(service *moderation.Service) *ScreenCommentWorker {
	return &ScreenCommentWorker{service: service}
}

func (w *ScreenCommentWorker) Work(ctx context.Context, job *river.Job[moderation.ScreenComment]) error {
	return w.service.ScreenComment(ctx, job.Args.CommentID)
}

func (w *ScreenCommentWorker) Timeout(*river.Job[moderation.ScreenComment]) time.Duration {
	return screeningTimeout
}
