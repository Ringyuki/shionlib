package moderationjobs

import (
	"context"
	"errors"
	"testing"

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
	walkthrough := repo.SeedWalkthrough(moderation.WalkthroughSubject{CreatorID: 1, GameID: 1, Title: "t", HTML: "<p>c</p>"}, moderationtest.WalkthroughHidden)
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
