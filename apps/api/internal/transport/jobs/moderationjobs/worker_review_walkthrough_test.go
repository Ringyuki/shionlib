package moderationjobs

import (
	"testing"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
)

func TestReviewWalkthroughWorkerRunsTheService(t *testing.T) {
	f := newFixture(t)
	walkthrough := f.repo.SeedWalkthrough(moderation.WalkthroughSubject{CreatorID: 1, GameID: 1, Title: "t", HTML: "<p>c</p>", ReviewPending: true}, moderationtest.WalkthroughHidden)
	if err := NewReviewWalkthroughWorker(f.service).Work(t.Context(), &river.Job[moderation.ReviewWalkthrough]{Args: moderation.ReviewWalkthrough{WalkthroughID: walkthrough.ID}}); err != nil {
		t.Fatal(err)
	}
	if f.repo.WalkthroughStatus(walkthrough.ID) != moderationtest.WalkthroughPublished {
		t.Fatal("the worker must run the moderation service")
	}
	if (&ReviewWalkthroughWorker{}).Timeout(nil) != reviewTimeout {
		t.Fatal("unexpected timeout")
	}
}
