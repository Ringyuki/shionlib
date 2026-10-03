package moderationjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type ReviewWalkthroughWorker struct {
	river.WorkerDefaults[moderation.ReviewWalkthrough]
	service *moderation.Service
}

func NewReviewWalkthroughWorker(service *moderation.Service) *ReviewWalkthroughWorker {
	return &ReviewWalkthroughWorker{service: service}
}

func (w *ReviewWalkthroughWorker) Work(ctx context.Context, job *river.Job[moderation.ReviewWalkthrough]) error {
	return w.service.ReviewWalkthrough(ctx, job.Args.WalkthroughID)
}

func (w *ReviewWalkthroughWorker) Timeout(*river.Job[moderation.ReviewWalkthrough]) time.Duration {
	return reviewTimeout
}
