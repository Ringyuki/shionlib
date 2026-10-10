package moderationjobs

import (
	"errors"
	"testing"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
)

func TestReviewCommentWorkerRunsTheService(t *testing.T) {
	f := newFixture(t)
	comment := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, Text: "b"}, moderationtest.CommentPending)
	if err := NewReviewCommentWorker(f.service).Work(t.Context(), &river.Job[moderation.ReviewComment]{Args: moderation.ReviewComment{CommentID: comment.ID}}); err != nil {
		t.Fatal(err)
	}
	if f.repo.CommentStatus(comment.ID) != moderationtest.CommentVisible {
		t.Fatal("the worker must run the moderation service")
	}
}

func TestReviewCommentWorkerReturnsFailuresForRetry(t *testing.T) {
	f := newFixture(t)
	f.classifier.ReviewErr = errors.New("upstream down")
	comment := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, Text: "d"}, moderationtest.CommentPending)
	if err := NewReviewCommentWorker(f.service).Work(t.Context(), &river.Job[moderation.ReviewComment]{Args: moderation.ReviewComment{CommentID: comment.ID}}); err == nil {
		t.Fatal("failures are returned so River retries the job")
	}
}
