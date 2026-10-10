package walkthrough_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

var (
	author   = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	stranger = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin    = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	guest    = actor.Guest()
)

const gameID = 81

type fixture struct {
	repo       *walkthroughtest.MemoryRepository
	queue      *moderationtest.Queue
	activities *moderationtest.Activities
	service    *walkthrough.Service
}

func newFixture(cards ...game.Card) fixture {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo := walkthroughtest.NewMemoryRepository(func() time.Time {
		clock = clock.Add(time.Second)
		return clock
	})
	cards = append(cards, game.Card{ID: gameID})
	for _, card := range cards {
		repo.AddGame(card.ID, false)
	}
	f := fixture{repo: repo, queue: &moderationtest.Queue{}, activities: &moderationtest.Activities{}}
	f.service = walkthrough.NewService(repo, gametest.NewCards(cards...), f.activities, f.queue, &txtest.Immediate{})
	return f
}

func note(t *testing.T, text string) *richtext.Document {
	t.Helper()
	raw, _ := json.Marshal(map[string]any{"type": "doc", "content": []any{
		map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": text}}},
	}})
	doc, err := richtext.Parse(raw, richtext.Comment)
	if err != nil {
		t.Fatal(err)
	}
	return &doc
}

func route(key, name string, steps ...walkthrough.Step) walkthrough.Route {
	return walkthrough.Route{Key: key, Name: name, Steps: steps}
}

func choice(text string) walkthrough.Step {
	return walkthrough.Step{Kind: walkthrough.StepChoice, Text: text}
}

func TestWriteStartsAWalkthroughThenReplacesIt(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	first, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Routes: []walkthrough.Route{
		{Key: "a", Name: " むぎ ", Requires: []string{"gone"}, Steps: []walkthrough.Step{{Kind: walkthrough.StepGap}, choice(" 左 ")}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	want := []walkthrough.Route{{Key: "a", Name: "むぎ", Characters: []int{}, Requires: []string{}, Steps: []walkthrough.Step{choice("左")}}}
	if first.Status != walkthrough.StatusDraft || first.ReviewPending || first.Edited || first.CreatorID != author.UserID || first.Creator.ID != author.UserID ||
		first.Note != nil || first.Text != "むぎ\n左" || !reflect.DeepEqual(first.Routes, want) || len(f.queue.All()) != 0 {
		t.Fatalf("a draft is stored tidy and is not reviewed: %+v", first)
	}
	recorded := f.activities.All()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeWalkthroughCreate || recorded[0].UserID != author.UserID || *recorded[0].GameID != gameID || *recorded[0].WalkthroughID != first.ID {
		t.Fatalf("unexpected activity %+v", recorded)
	}

	second, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Note: note(t, "セーブ01までの選択肢は分岐に影響無いかも？")})
	if err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID || !second.Edited || len(second.Routes) != 0 || second.Note == nil || second.Text != "セーブ01までの選択肢は分岐に影響無いかも？" || second.Lang == nil || *second.Lang != "jp" {
		t.Fatalf("writing again replaces what was written: %+v", second)
	}
	if len(f.activities.All()) != 1 {
		t.Fatal("replacing a walkthrough records no activity")
	}

	other, err := f.service.Write(ctx, stranger, walkthrough.WriteInput{GameID: gameID, Note: note(t, "mine")})
	if err != nil || other.ID == first.ID || other.CreatorID != stranger.UserID {
		t.Fatalf("every author has a walkthrough of their own: %+v %v", other, err)
	}
	if _, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: 404}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
}

func TestPublishingHoldsAWalkthroughForReview(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	routes := []walkthrough.Route{route("a", "共通ルート", choice("この攻略では、はじめに共通ルートを進めます"))}
	published, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Routes: routes, Publish: true})
	if err != nil {
		t.Fatal(err)
	}
	if published.Status != walkthrough.StatusHidden || !published.ReviewPending || published.Lang == nil || *published.Lang != "jp" {
		t.Fatalf("unexpected walkthrough %+v", published)
	}
	if jobs := f.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: published.ID}) {
		t.Fatalf("expected a review job, got %+v", jobs)
	}
	draft, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Routes: routes})
	if err != nil || draft.Status != walkthrough.StatusDraft || draft.ReviewPending || len(f.queue.All()) != 1 {
		t.Fatalf("saving a draft takes the walkthrough back: %+v %v", draft, err)
	}
	if _, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Routes: routes, Publish: true}); err != nil || len(f.queue.All()) != 2 {
		t.Fatalf("publishing again asks for another review: %v %+v", err, f.queue.All())
	}
}

func TestPublishingRefusesWhatIsNotFinished(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	unnamed := []walkthrough.Route{route("a", "むぎ", choice("左")), route("b", "  ", choice("右"))}
	if _, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Publish: true}); !errors.Is(err, walkthrough.ErrEmpty) {
		t.Fatalf("nothing written: %v", err)
	}
	if _, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Note: note(t, "x"), Routes: unnamed, Publish: true}); !errors.Is(err, walkthrough.ErrRouteIncomplete) {
		t.Fatalf("a route without a name: %v", err)
	}
	if _, err := f.repo.Written(ctx, gameID, author.UserID); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("a refused walkthrough is not stored: %v", err)
	}
	if draft, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Routes: unnamed}); err != nil || len(draft.Routes) != 2 {
		t.Fatalf("a draft may be unfinished: %+v %v", draft, err)
	}
	overlong := []walkthrough.Route{route("a", "x")}
	for range walkthrough.MaxTextLength/250 + 1 {
		overlong[0].Steps = append(overlong[0].Steps, choice(strings.Repeat("x", 250)))
	}
	if _, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Routes: overlong}); !errors.Is(err, walkthrough.ErrContentTooLong) {
		t.Fatalf("text beyond the limit: %v", err)
	}
}

func TestDeleteRequiresOwnershipAndFreesTheAuthor(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created, _ := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Note: note(t, "x")})

	if err := f.service.Delete(ctx, author, 999); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("delete missing: %v", err)
	}
	if err := f.service.Delete(ctx, stranger, created.ID); !errors.Is(err, walkthrough.ErrNotOwner) {
		t.Fatalf("delete by stranger: %v", err)
	}
	if err := f.service.Delete(ctx, author, created.ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.Get(ctx, created.ID); got.Status != walkthrough.StatusDeleted {
		t.Fatalf("delete is a soft delete: %+v", got)
	}
	if err := f.service.Delete(ctx, author, created.ID); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("deleted walkthroughs are gone: %v", err)
	}
	again, err := f.service.Write(ctx, author, walkthrough.WriteInput{GameID: gameID, Note: note(t, "y")})
	if err != nil || again.ID == created.ID || again.Edited || len(f.activities.All()) != 2 {
		t.Fatalf("an author may start over after deleting: %+v %v", again, err)
	}
	if err := f.service.Delete(ctx, admin, again.ID); err != nil {
		t.Fatalf("admins may delete: %v", err)
	}
}

func TestGetHidesUnpublishedWalkthroughs(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	hidden := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusHidden})
	published := f.repo.Seed(walkthrough.Walkthrough{GameID: 90, CreatorID: author.UserID, Routes: []walkthrough.Route{route("a", "むぎ", choice("左"))}, Status: walkthrough.StatusPublished})
	deleted := f.repo.Seed(walkthrough.Walkthrough{GameID: 91, CreatorID: author.UserID, Status: walkthrough.StatusDeleted})

	if _, err := f.service.Get(ctx, stranger, hidden.ID); !errors.Is(err, walkthrough.ErrNotOwner) {
		t.Fatalf("hidden for stranger: %v", err)
	}
	if _, err := f.service.Get(ctx, guest, hidden.ID); !errors.Is(err, walkthrough.ErrNotOwner) {
		t.Fatalf("hidden for guest: %v", err)
	}
	if _, err := f.service.Get(ctx, author, hidden.ID); err != nil {
		t.Fatalf("owner sees hidden: %v", err)
	}
	if _, err := f.service.Get(ctx, admin, hidden.ID); err != nil {
		t.Fatalf("admins see hidden: %v", err)
	}
	if view, err := f.service.Get(ctx, guest, published.ID); err != nil || len(view.Routes) != 1 || view.Creator.ID != author.UserID {
		t.Fatalf("guests read what is published: %+v %v", view, err)
	}
	if _, err := f.service.Get(ctx, author, deleted.ID); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("deleted: %v", err)
	}
	if _, err := f.service.Get(ctx, author, 999); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func summaryIDs(summaries []walkthrough.Summary) []int {
	out := make([]int, len(summaries))
	for i, summary := range summaries {
		out[i] = summary.ID
	}
	return out
}

func TestListByGamePutsTheViewersOwnFirst(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	older := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusPublished})
	draft := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: stranger.UserID, Status: walkthrough.StatusDraft})
	newer := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: admin.UserID, Status: walkthrough.StatusPublished})
	f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: 9, Status: walkthrough.StatusHidden})

	cases := []struct {
		viewer actor.Actor
		want   []int
	}{
		{guest, []int{newer.ID, older.ID}},
		{actor.Actor{UserID: 8, Role: actor.RoleUser}, []int{newer.ID, older.ID}},
		{author, []int{older.ID, newer.ID}},
		{stranger, []int{draft.ID, newer.ID, older.ID}},
		{admin, []int{newer.ID, older.ID}},
	}
	for _, c := range cases {
		got, err := f.service.ListByGame(ctx, c.viewer, gameID)
		if err != nil || !reflect.DeepEqual(summaryIDs(got), c.want) {
			t.Fatalf("viewer %d: %v %v", c.viewer.UserID, summaryIDs(got), err)
		}
	}
	if got, err := f.service.ListByGame(ctx, guest, 404); err != nil || len(got) != 0 {
		t.Fatalf("a game without walkthroughs: %v %v", got, err)
	}
}

func TestListByCreatorShowsOwnersTheirUnpublishedAndAttachesCards(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 90, Covers: []game.Cover{{URL: "safe"}, {URL: "rated", Sexual: 2}}})
	published := f.repo.Seed(walkthrough.Walkthrough{GameID: 90, CreatorID: author.UserID, Routes: []walkthrough.Route{route("a", "x"), route("b", "y")}, Status: walkthrough.StatusPublished})
	hidden := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusHidden})
	f.repo.Seed(walkthrough.Walkthrough{GameID: 91, CreatorID: author.UserID, Status: walkthrough.StatusDeleted})
	page := walkthrough.Page{Number: 1, Size: 10}

	own, total, err := f.service.ListByCreator(ctx, author, author.UserID, page)
	if err != nil || total != 2 || !reflect.DeepEqual(summaryIDs(own), []int{hidden.ID, published.ID}) {
		t.Fatalf("own listing %v %v", summaryIDs(own), err)
	}
	if own[1].Game == nil || own[1].Game.ID != 90 || len(own[1].Game.Covers) != 1 || own[1].RouteCount != 2 {
		t.Fatalf("strict viewers get safe covers: %+v", own[1])
	}
	others, total, _ := f.service.ListByCreator(ctx, stranger, author.UserID, page)
	if total != 1 || !reflect.DeepEqual(summaryIDs(others), []int{published.ID}) || len(others[0].Game.Covers) != 2 {
		t.Fatalf("others only see published walkthroughs: %v", summaryIDs(others))
	}
}

type stubStore struct{}

func (stubStore) Search(context.Context, walkthrough.AdminFilter, walkthrough.Page) ([]walkthrough.AdminEntry, int, error) {
	return nil, 0, nil
}

func (stubStore) Detail(context.Context, int) (walkthrough.AdminDetail, error) {
	return walkthrough.AdminDetail{}, walkthrough.ErrNotFound
}

func TestAdminStatusAndRescan(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	service := walkthrough.NewAdminService(f.repo, stubStore{}, f.queue, &txtest.Immediate{})
	hidden := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusHidden})
	deleted := f.repo.Seed(walkthrough.Walkthrough{GameID: 90, CreatorID: author.UserID, Status: walkthrough.StatusDeleted})

	if err := service.SetStatus(ctx, 999, walkthrough.StatusPublished); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if err := service.SetStatus(ctx, hidden.ID, walkthrough.StatusPublished); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.Get(ctx, hidden.ID); got.Status != walkthrough.StatusPublished || got.ReviewPending {
		t.Fatalf("status not changed or review still pending: %+v", got)
	}
	if err := service.Rescan(ctx, deleted.ID); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("deleted walkthroughs cannot be rescanned: %v", err)
	}
	if err := service.Rescan(ctx, hidden.ID); err != nil {
		t.Fatal(err)
	}
	if jobs := f.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: hidden.ID}) {
		t.Fatalf("unexpected jobs %+v", jobs)
	}
	if got, _ := f.repo.Get(ctx, hidden.ID); got.Status != walkthrough.StatusPublished || !got.ReviewPending {
		t.Fatal("rescan keeps the status and marks the review pending")
	}
}
