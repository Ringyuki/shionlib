package moderationjobs

import (
	"testing"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
)

func TestScreenCommentWorkerRunsTheService(t *testing.T) {
	f := newFixture(t)
	comment := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, HTML: "<p>a</p>"}, moderationtest.CommentPending)
	if err := NewScreenCommentWorker(f.service).Work(t.Context(), &river.Job[moderation.ScreenComment]{Args: moderation.ScreenComment{CommentID: comment.ID}}); err != nil {
		t.Fatal(err)
	}
	if f.repo.CommentStatus(comment.ID) != moderationtest.CommentVisible {
		t.Fatal("the worker must run the moderation service")
	}
	if (&ScreenCommentWorker{}).Timeout(nil) != screeningTimeout {
		t.Fatal("unexpected timeout")
	}
}
