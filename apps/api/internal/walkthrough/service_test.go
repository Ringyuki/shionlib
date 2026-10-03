package walkthrough_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
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

func document(t *testing.T, texts ...string) lexical.Document {
	t.Helper()
	children := make([]any, len(texts))
	for i, text := range texts {
		children[i] = map[string]any{"type": "paragraph", "children": []any{map[string]any{"type": "text", "text": text}}}
	}
	raw, _ := json.Marshal(map[string]any{"root": map[string]any{"type": "root", "children": children}})
	doc, err := lexical.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return doc
}

func TestCreateHoldsPublishedWalkthroughsForReview(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created, err := f.service.Create(ctx, author, walkthrough.CreateInput{GameID: gameID, Title: "共通ルート攻略", Content: document(t, "この攻略では、はじめに共通ルートを進めて、三日目の選択肢でヒロイン分岐に入ります。"), Status: walkthrough.StatusPublished})
	if err != nil {
		t.Fatal(err)
	}
	if created.Status != walkthrough.StatusHidden || created.CreatorID != author.UserID || created.Lang == nil || *created.Lang != "jp" || created.Creator.ID != author.UserID ||
		created.HTML != `<p class="[&amp;:not(:first-child)]:mt-6"><span>この攻略では、はじめに共通ルートを進めて、三日目の選択肢でヒロイン分岐に入ります。</span></p>` {
		t.Fatalf("unexpected walkthrough %+v", created)
	}
	if jobs := f.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: created.ID}) {
		t.Fatalf("expected a review job, got %+v", jobs)
	}
	recorded := f.activities.All()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeWalkthroughCreate || recorded[0].UserID != author.UserID || *recorded[0].GameID != gameID || *recorded[0].WalkthroughID != created.ID {
		t.Fatalf("unexpected activity %+v", recorded)
	}

	draft, err := f.service.Create(ctx, author, walkthrough.CreateInput{GameID: gameID, Title: "x", Content: document(t, "Guide"), Status: walkthrough.StatusDraft})
	if err != nil {
		t.Fatal(err)
	}
	if draft.Status != walkthrough.StatusDraft || draft.Lang != nil || len(f.queue.All()) != 1 {
		t.Fatalf("drafts are stored as is and not reviewed: %+v", draft)
	}
	if _, err := f.service.Create(ctx, author, walkthrough.CreateInput{GameID: 404, Title: "x", Content: document(t, "x"), Status: walkthrough.StatusDraft}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	texts := make([]string, 2000)
	for i := range texts {
		texts[i] = "x"
	}
	if _, err := f.service.Create(ctx, author, walkthrough.CreateInput{GameID: gameID, Title: "x", Content: document(t, texts...), Status: walkthrough.StatusDraft}); !errors.Is(err, walkthrough.ErrContentTooLong) {
		t.Fatalf("rendered html beyond the column size: %v", err)
	}
}

func TestUpdateAndDeleteRequireOwnership(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created, _ := f.service.Create(ctx, author, walkthrough.CreateInput{GameID: gameID, Title: "Guide", Content: document(t, "x"), Status: walkthrough.StatusDraft})
	input := walkthrough.UpdateInput{Title: "這篇攻略會說明遊戲流程", Content: document(t, "與結局條件，請依照步驟選擇。"), Status: walkthrough.StatusPublished}

	if _, err := f.service.Update(ctx, author, 999, input); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("update missing: %v", err)
	}
	if _, err := f.service.Update(ctx, stranger, created.ID, input); !errors.Is(err, walkthrough.ErrNotOwner) {
		t.Fatalf("update by stranger: %v", err)
	}
	updated, err := f.service.Update(ctx, admin, created.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Status != walkthrough.StatusHidden || !updated.Edited || updated.Title != input.Title || *updated.Lang != "zh-hant" {
		t.Fatalf("unexpected update %+v", updated)
	}
	if jobs := f.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: created.ID}) {
		t.Fatalf("publishing an update requests a review: %+v", jobs)
	}
	if len(f.activities.All()) != 1 {
		t.Fatal("updates do not record activities")
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
	if _, err := f.service.Update(ctx, author, created.ID, input); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("deleted walkthroughs cannot be edited: %v", err)
	}
}

func TestGetHidesUnpublishedWalkthroughs(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	hidden := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Title: "h", Content: json.RawMessage(`{"root":{}}`), Status: walkthrough.StatusHidden})
	published := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Title: "p", Content: json.RawMessage(`{"root":{}}`), Status: walkthrough.StatusPublished})
	deleted := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusDeleted})

	if _, err := f.service.Get(ctx, stranger, hidden.ID, false); !errors.Is(err, walkthrough.ErrNotOwner) {
		t.Fatalf("hidden for stranger: %v", err)
	}
	if _, err := f.service.Get(ctx, guest, hidden.ID, false); !errors.Is(err, walkthrough.ErrNotOwner) {
		t.Fatalf("hidden for guest: %v", err)
	}
	if view, err := f.service.Get(ctx, author, hidden.ID, true); err != nil || view.Content == nil {
		t.Fatalf("owner sees hidden with content: %+v %v", view, err)
	}
	if _, err := f.service.Get(ctx, admin, hidden.ID, false); err != nil {
		t.Fatalf("admins see hidden: %v", err)
	}
	if view, err := f.service.Get(ctx, guest, published.ID, false); err != nil || view.Content != nil {
		t.Fatalf("guests see published without content: %+v %v", view, err)
	}
	if _, err := f.service.Get(ctx, author, deleted.ID, false); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("deleted: %v", err)
	}
	if _, err := f.service.Get(ctx, author, 999, false); !errors.Is(err, walkthrough.ErrNotFound) {
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

func TestListByGameAppliesRoleVisibility(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	published := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusPublished})
	draft := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusDraft})
	hidden := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusHidden})
	page := walkthrough.Page{Number: 1, Size: 10}

	cases := []struct {
		viewer actor.Actor
		want   []int
	}{
		{guest, []int{published.ID}},
		{stranger, []int{published.ID}},
		{admin, []int{draft.ID, published.ID}},
		{author, []int{hidden.ID, draft.ID, published.ID}},
	}
	for _, c := range cases {
		got, _, err := f.service.ListByGame(ctx, c.viewer, gameID, nil, page)
		if err != nil || !reflect.DeepEqual(summaryIDs(got), c.want) {
			t.Fatalf("viewer %d: %v %v", c.viewer.UserID, summaryIDs(got), err)
		}
	}
	status := walkthrough.StatusDraft
	if got, _, _ := f.service.ListByGame(ctx, stranger, gameID, &status, page); len(got) != 0 {
		t.Fatalf("strangers cannot filter into drafts: %v", summaryIDs(got))
	}
}

func TestListByCreatorFiltersStatusesAndAttachesCards(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 90, Covers: []game.Cover{{URL: "safe"}, {URL: "rated", Sexual: 2}}})
	published := f.repo.Seed(walkthrough.Walkthrough{GameID: 90, CreatorID: author.UserID, Status: walkthrough.StatusPublished})
	hidden := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusHidden})
	f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusDeleted})
	page := walkthrough.Page{Number: 1, Size: 10}

	own, total, err := f.service.ListByCreator(ctx, author, author.UserID, nil, page)
	if err != nil || total != 2 || !reflect.DeepEqual(summaryIDs(own), []int{hidden.ID, published.ID}) {
		t.Fatalf("own listing %v %v", summaryIDs(own), err)
	}
	if own[1].Game == nil || own[1].Game.ID != 90 || len(own[1].Game.Covers) != 1 {
		t.Fatalf("strict viewers get safe covers: %+v", own[1].Game)
	}
	status := walkthrough.StatusHidden
	if filtered, _, _ := f.service.ListByCreator(ctx, author, author.UserID, &status, page); !reflect.DeepEqual(summaryIDs(filtered), []int{hidden.ID}) {
		t.Fatalf("owners may filter by hidden: %v", summaryIDs(filtered))
	}
	others, _, _ := f.service.ListByCreator(ctx, stranger, author.UserID, &status, page)
	if !reflect.DeepEqual(summaryIDs(others), []int{published.ID}) || len(others[0].Game.Covers) != 2 {
		t.Fatalf("others only see published walkthroughs and ignore the hidden filter: %v", summaryIDs(others))
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
	deleted := f.repo.Seed(walkthrough.Walkthrough{GameID: gameID, CreatorID: author.UserID, Status: walkthrough.StatusDeleted})

	if err := service.SetStatus(ctx, 999, walkthrough.StatusPublished); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if err := service.SetStatus(ctx, hidden.ID, walkthrough.StatusPublished); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.Get(ctx, hidden.ID); got.Status != walkthrough.StatusPublished {
		t.Fatalf("status not changed: %+v", got)
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
	if got, _ := f.repo.Get(ctx, hidden.ID); got.Status != walkthrough.StatusPublished {
		t.Fatal("rescan does not change the status")
	}
}
