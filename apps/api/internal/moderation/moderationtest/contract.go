package moderationtest

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type CommentFixture struct {
	ParentID *int
	Status   string
	HTML     string
}

type Env struct {
	Repo              moderation.Repository
	NewComment        func(t *testing.T, fixture CommentFixture) moderation.CommentSubject
	CommentStatus     func(t *testing.T, id int) string
	NewWalkthrough    func(t *testing.T, status string) moderation.WalkthroughSubject
	WalkthroughStatus func(t *testing.T, id int) string
	EventCount        func(t *testing.T) int
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("missing subjects are reported", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.CommentSubject(ctx, 987654); !errors.Is(err, moderation.ErrSubjectNotFound) {
			t.Fatalf("comment subject: %v", err)
		}
		if _, err := env.Repo.LockCommentSubject(ctx, 987654); !errors.Is(err, moderation.ErrSubjectNotFound) {
			t.Fatalf("lock comment subject: %v", err)
		}
		if _, err := env.Repo.WalkthroughSubject(ctx, 987654); !errors.Is(err, moderation.ErrSubjectNotFound) {
			t.Fatalf("walkthrough subject: %v", err)
		}
		if _, err := env.Repo.LockWalkthroughSubject(ctx, 987654); !errors.Is(err, moderation.ErrSubjectNotFound) {
			t.Fatalf("lock walkthrough subject: %v", err)
		}
		missing := 987654
		if err := env.Repo.RecordEvent(ctx, moderation.NewEvent{CommentID: &missing, Auditor: moderation.AuditorScreening, Model: "m", Decision: moderation.DecisionAllow, TopCategory: moderation.CategoryHate, Categories: json.RawMessage(`{}`)}); !errors.Is(err, moderation.ErrSubjectNotFound) {
			t.Fatalf("event for missing comment: %v", err)
		}
	})

	t.Run("comment subjects describe the thread and move between states", func(t *testing.T) {
		env := newEnv(t)
		parent := env.NewComment(t, CommentFixture{Status: CommentVisible, HTML: "<p>parent</p>"})
		child := env.NewComment(t, CommentFixture{ParentID: &parent.ID, Status: CommentPending, HTML: "<p>child</p>"})

		got, err := env.Repo.CommentSubject(ctx, child.ID)
		if err != nil {
			t.Fatal(err)
		}
		if !got.Pending || got.HTML != "<p>child</p>" || got.CreatorID != child.CreatorID || got.GameID != child.GameID || got.Game != child.Game {
			t.Fatalf("unexpected subject %+v, want %+v", got, child)
		}
		if got.ParentID == nil || *got.ParentID != parent.ID || got.ParentCreatorID == nil || *got.ParentCreatorID != parent.CreatorID || got.ParentHTML != "<p>parent</p>" {
			t.Fatalf("parent not described: %+v", got)
		}
		root, err := env.Repo.LockCommentSubject(ctx, parent.ID)
		if err != nil {
			t.Fatal(err)
		}
		if root.Pending || root.ParentID != nil || root.ParentCreatorID != nil || root.ParentHTML != "" {
			t.Fatalf("unexpected root subject %+v", root)
		}
		if err := env.Repo.ApproveComment(ctx, child.ID); err != nil {
			t.Fatal(err)
		}
		if status := env.CommentStatus(t, child.ID); status != CommentVisible {
			t.Fatalf("approve: %s", status)
		}
		if err := env.Repo.BlockComment(ctx, child.ID); err != nil {
			t.Fatal(err)
		}
		if status := env.CommentStatus(t, child.ID); status != CommentBlocked {
			t.Fatalf("block: %s", status)
		}
		if got, _ := env.Repo.CommentSubject(ctx, child.ID); got.Pending {
			t.Fatal("blocked comment reported as pending")
		}
	})

	t.Run("walkthroughs publish only from published or hidden and never leave deleted", func(t *testing.T) {
		env := newEnv(t)
		hidden := env.NewWalkthrough(t, WalkthroughHidden)
		draft := env.NewWalkthrough(t, WalkthroughDraft)
		deleted := env.NewWalkthrough(t, WalkthroughDeleted)

		got, err := env.Repo.WalkthroughSubject(ctx, hidden.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Deleted || got.Title != hidden.Title || got.HTML != hidden.HTML || got.CreatorID != hidden.CreatorID || got.GameID != hidden.GameID || got.Game != hidden.Game {
			t.Fatalf("unexpected walkthrough subject %+v, want %+v", got, hidden)
		}
		if locked, err := env.Repo.LockWalkthroughSubject(ctx, deleted.ID); err != nil || !locked.Deleted {
			t.Fatalf("deleted walkthrough must be reported: %+v %v", locked, err)
		}
		for _, id := range []int{hidden.ID, draft.ID, deleted.ID} {
			if err := env.Repo.PublishWalkthrough(ctx, id); err != nil {
				t.Fatal(err)
			}
		}
		if env.WalkthroughStatus(t, hidden.ID) != WalkthroughPublished || env.WalkthroughStatus(t, draft.ID) != WalkthroughDraft || env.WalkthroughStatus(t, deleted.ID) != WalkthroughDeleted {
			t.Fatalf("unexpected statuses after publish: %s %s %s", env.WalkthroughStatus(t, hidden.ID), env.WalkthroughStatus(t, draft.ID), env.WalkthroughStatus(t, deleted.ID))
		}
		for _, id := range []int{hidden.ID, draft.ID, deleted.ID} {
			if err := env.Repo.HideWalkthrough(ctx, id); err != nil {
				t.Fatal(err)
			}
		}
		if env.WalkthroughStatus(t, hidden.ID) != WalkthroughHidden || env.WalkthroughStatus(t, draft.ID) != WalkthroughHidden || env.WalkthroughStatus(t, deleted.ID) != WalkthroughDeleted {
			t.Fatalf("unexpected statuses after hide: %s %s %s", env.WalkthroughStatus(t, hidden.ID), env.WalkthroughStatus(t, draft.ID), env.WalkthroughStatus(t, deleted.ID))
		}
	})

	t.Run("events are recorded for comments and walkthroughs", func(t *testing.T) {
		env := newEnv(t)
		comment := env.NewComment(t, CommentFixture{Status: CommentPending, HTML: "<p>x</p>"})
		walkthrough := env.NewWalkthrough(t, WalkthroughHidden)
		score, reason, evidence := 0.12345, "reason", "evidence"
		if err := env.Repo.RecordEvent(ctx, moderation.NewEvent{
			CommentID:   &comment.ID,
			Auditor:     moderation.AuditorScreening,
			Model:       "omni-moderation-latest",
			Decision:    moderation.DecisionReview,
			TopCategory: moderation.CategoryHate,
			Categories:  json.RawMessage(`{"hate":true}`),
			Scores:      json.RawMessage(`{"hate":0.12345}`),
			MaxScore:    &score,
		}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.RecordEvent(ctx, moderation.NewEvent{
			WalkthroughID: &walkthrough.ID,
			Auditor:       moderation.AuditorReview,
			Model:         "gpt-5-mini",
			Decision:      moderation.DecisionBlock,
			TopCategory:   moderation.CategorySpam,
			Categories:    json.RawMessage(`{"spam":true}`),
			Reason:        &reason,
			Evidence:      &evidence,
		}); err != nil {
			t.Fatal(err)
		}
		if count := env.EventCount(t); count != 2 {
			t.Fatalf("expected 2 events, got %d", count)
		}
	})
}
