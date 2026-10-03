package moderationjobs

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func TestWorkersDelegateToTheService(t *testing.T) {
	ctx := context.Background()
	repo := moderationtest.NewMemoryRepository()
	classifier := &moderationtest.Classifier{ScreenErr: moderation.ErrClassifierDisabled, ReviewErr: moderation.ErrClassifierDisabled}
	service := moderation.NewService(repo, classifier, &moderationtest.Messages{}, &moderationtest.Activities{}, &moderationtest.Queue{}, &txtest.Immediate{})
	Register(service)(river.NewWorkers())

	screened := repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, HTML: "<p>a</p>"}, moderationtest.CommentPending)
	if err := (&screenCommentWorker{service: service}).Work(ctx, &river.Job[moderation.ScreenComment]{Args: moderation.ScreenComment{CommentID: screened.ID}}); err != nil {
		t.Fatal(err)
	}
	reviewed := repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, HTML: "<p>b</p>"}, moderationtest.CommentPending)
	if err := (&reviewCommentWorker{service: service}).Work(ctx, &river.Job[moderation.ReviewComment]{Args: moderation.ReviewComment{CommentID: reviewed.ID}}); err != nil {
		t.Fatal(err)
	}
	walkthrough := repo.SeedWalkthrough(moderation.WalkthroughSubject{CreatorID: 1, GameID: 1, Title: "t", HTML: "<p>c</p>", ReviewPending: true}, moderationtest.WalkthroughHidden)
	if err := (&reviewWalkthroughWorker{service: service}).Work(ctx, &river.Job[moderation.ReviewWalkthrough]{Args: moderation.ReviewWalkthrough{WalkthroughID: walkthrough.ID}}); err != nil {
		t.Fatal(err)
	}
	if repo.CommentStatus(screened.ID) != moderationtest.CommentVisible || repo.CommentStatus(reviewed.ID) != moderationtest.CommentVisible || repo.WalkthroughStatus(walkthrough.ID) != moderationtest.WalkthroughPublished {
		t.Fatal("workers must run the moderation service")
	}

	classifier.ReviewErr = errors.New("upstream down")
	pending := repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, HTML: "<p>d</p>"}, moderationtest.CommentPending)
	if err := (&reviewCommentWorker{service: service}).Work(ctx, &river.Job[moderation.ReviewComment]{Args: moderation.ReviewComment{CommentID: pending.ID}}); err == nil {
		t.Fatal("failures are returned so River retries the job")
	}
	if (&reviewWalkthroughWorker{}).Timeout(nil) != reviewTimeout || (&screenCommentWorker{}).Timeout(nil) != screeningTimeout {
		t.Fatal("unexpected timeouts")
	}
}

type requeuer struct {
	cutoffs []time.Time
}

func (r *requeuer) RequeueWalkthroughReviews(_ context.Context, updatedBefore time.Time) error {
	r.cutoffs = append(r.cutoffs, updatedBefore)
	return nil
}

func TestRequeueTaskLooksBackOneHour(t *testing.T) {
	r := &requeuer{}
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	tasks := Tasks(r, func() time.Time { return now })
	if len(tasks) != 1 || tasks[0].Name != "moderation_requeue_walkthrough_reviews" || tasks[0].Schedule != "*/30 * * * *" {
		t.Fatalf("tasks %+v", tasks)
	}
	if err := tasks[0].Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(r.cutoffs) != 1 || !r.cutoffs[0].Equal(now.Add(-time.Hour)) {
		t.Fatalf("cutoffs %v", r.cutoffs)
	}
}
