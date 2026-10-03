package moderationjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

const (
	screeningTimeout = time.Minute
	reviewTimeout    = 5 * time.Minute
)

func Register(service *moderation.Service) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, &screenCommentWorker{service: service})
		river.AddWorker(workers, &reviewCommentWorker{service: service})
		river.AddWorker(workers, &reviewWalkthroughWorker{service: service})
	}
}

type screenCommentWorker struct {
	river.WorkerDefaults[moderation.ScreenComment]
	service *moderation.Service
}

func (w *screenCommentWorker) Work(ctx context.Context, job *river.Job[moderation.ScreenComment]) error {
	return w.service.ScreenComment(ctx, job.Args.CommentID)
}

func (w *screenCommentWorker) Timeout(*river.Job[moderation.ScreenComment]) time.Duration {
	return screeningTimeout
}

type reviewCommentWorker struct {
	river.WorkerDefaults[moderation.ReviewComment]
	service *moderation.Service
}

func (w *reviewCommentWorker) Work(ctx context.Context, job *river.Job[moderation.ReviewComment]) error {
	return w.service.ReviewComment(ctx, job.Args.CommentID)
}

func (w *reviewCommentWorker) Timeout(*river.Job[moderation.ReviewComment]) time.Duration {
	return reviewTimeout
}

type reviewWalkthroughWorker struct {
	river.WorkerDefaults[moderation.ReviewWalkthrough]
	service *moderation.Service
}

func (w *reviewWalkthroughWorker) Work(ctx context.Context, job *river.Job[moderation.ReviewWalkthrough]) error {
	return w.service.ReviewWalkthrough(ctx, job.Args.WalkthroughID)
}

func (w *reviewWalkthroughWorker) Timeout(*river.Job[moderation.ReviewWalkthrough]) time.Duration {
	return reviewTimeout
}

const (
	requeueSchedule     = "*/30 * * * *"
	requeueTimeout      = 2 * time.Minute
	staleWalkthroughAge = time.Hour
)

type Requeuer interface {
	RequeueWalkthroughReviews(ctx context.Context, updatedBefore time.Time) error
}

func Tasks(requeuer Requeuer, now func() time.Time) []jobs.Task {
	return []jobs.Task{{
		Name:     "moderation_requeue_walkthrough_reviews",
		Schedule: requeueSchedule,
		Timeout:  requeueTimeout,
		Run: func(ctx context.Context) error {
			return requeuer.RequeueWalkthroughReviews(ctx, now().Add(-staleWalkthroughAge))
		},
	}}
}
