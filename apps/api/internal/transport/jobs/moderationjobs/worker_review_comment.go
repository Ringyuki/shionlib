package moderationjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type ReviewCommentWorker struct {
	river.WorkerDefaults[moderation.ReviewComment]
	service *moderation.Service
}

func NewReviewCommentWorker(service *moderation.Service) *ReviewCommentWorker {
	return &ReviewCommentWorker{service: service}
}

func (w *ReviewCommentWorker) Work(ctx context.Context, job *river.Job[moderation.ReviewComment]) error {
	return w.service.ReviewComment(ctx, job.Args.CommentID)
}

func (w *ReviewCommentWorker) Timeout(*river.Job[moderation.ReviewComment]) time.Duration {
	return reviewTimeout
}
