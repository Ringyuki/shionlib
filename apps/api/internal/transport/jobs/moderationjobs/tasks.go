package moderationjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

func Register(service *moderation.Service) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewScreenCommentWorker(service))
		river.AddWorker(workers, NewReviewCommentWorker(service))
		river.AddWorker(workers, NewReviewWalkthroughWorker(service))
	}
}

const (
	requeueSchedule = "*/30 * * * *"
	requeueTimeout  = 2 * time.Minute
	staleReviewAge  = time.Hour
)

type Requeuer interface {
	RequeueStaleReviews(ctx context.Context, updatedBefore time.Time) error
}

func Tasks(requeuer Requeuer, now func() time.Time) []jobs.Task {
	return []jobs.Task{{
		Name:     "moderation_requeue_stale_reviews",
		Schedule: requeueSchedule,
		Timeout:  requeueTimeout,
		Run: func(ctx context.Context) error {
			return requeuer.RequeueStaleReviews(ctx, now().Add(-staleReviewAge))
		},
	}}
}
