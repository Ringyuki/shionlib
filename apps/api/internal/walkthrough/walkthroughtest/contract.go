package walkthroughtest

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type Env struct {
	Repo         walkthrough.Repository
	NewUser      func(t *testing.T) int
	NewGame      func(t *testing.T) int
	NewRatedGame func(t *testing.T) int
	SetUpdated   func(t *testing.T, id int, at time.Time)
}

var note = json.RawMessage(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"guide"}]}]}`)

var routes = []walkthrough.Route{
	{
		Key:        "a1",
		Name:       "むぎ",
		Characters: []int{7, 9},
		Requires:   []string{},
		Steps: []walkthrough.Step{
			{Kind: walkthrough.StepNote, Text: "【START】"},
			{Kind: walkthrough.StepChoice, Text: "左"},
			{Kind: walkthrough.StepSave, Slot: "01"},
			{Kind: walkthrough.StepGap},
			{Kind: walkthrough.StepChoice, Text: "メイド", Remark: "むぎ＆緋華"},
		},
		Ending: "むぎEND",
	},
	{
		Key:        "b2",
		Name:       "ハーレム",
		Characters: []int{},
		Requires:   []string{"a1"},
		Condition:  "共通終了時",
		Steps:      []walkthrough.Step{{Kind: walkthrough.StepLoad, Slot: "01"}},
	},
}

var day = time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

func sameJSON(t *testing.T, a, b json.RawMessage) bool {
	t.Helper()
	var left, right any
	if err := json.Unmarshal(a, &left); err != nil {
		t.Fatalf("decode %s: %v", a, err)
	}
	if err := json.Unmarshal(b, &right); err != nil {
		t.Fatalf("decode %s: %v", b, err)
	}
	return reflect.DeepEqual(left, right)
}

func create(ctx context.Context, t *testing.T, env Env, gameID, creatorID int, status walkthrough.Status, updated time.Time) walkthrough.Walkthrough {
	t.Helper()
	created, err := env.Repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Note: note, Routes: routes, Text: "guide", Status: status, CreatorID: creatorID})
	if err != nil {
		t.Fatal(err)
	}
	env.SetUpdated(t, created.ID, updated)
	return created
}

func ids(summaries []walkthrough.Summary) []int {
	out := make([]int, len(summaries))
	for i, summary := range summaries {
		out[i] = summary.ID
	}
	return out
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("lock: %v", err)
		}
		if _, err := env.Repo.LockWritten(ctx, 987654, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("lock written: %v", err)
		}
		if _, err := env.Repo.Written(ctx, 987654, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("written: %v", err)
		}
		if _, err := env.Repo.View(ctx, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("view: %v", err)
		}
		if err := env.Repo.Update(ctx, 987654, walkthrough.Changes{Text: "x", Status: walkthrough.StatusDraft}); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("update: %v", err)
		}
		if err := env.Repo.SetStatus(ctx, 987654, walkthrough.StatusDeleted); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("set status: %v", err)
		}
		if _, err := env.Repo.Create(ctx, walkthrough.NewWalkthrough{GameID: 987654, Text: "x", Status: walkthrough.StatusDraft, CreatorID: env.NewUser(t)}); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("create for missing game: %v", err)
		}
	})

	t.Run("create, view and update", func(t *testing.T) {
		env := newEnv(t)
		author, gameID := env.NewUser(t), env.NewGame(t)
		lang := "jp"
		created, err := env.Repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Note: note, Routes: routes, Text: "guide", Lang: &lang, Status: walkthrough.StatusHidden, CreatorID: author, ReviewPending: true})
		if err != nil {
			t.Fatal(err)
		}
		view, err := env.Repo.View(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if view.ID != created.ID || view.GameID != gameID || view.Text != "guide" || view.Lang == nil || *view.Lang != "jp" || view.Status != walkthrough.StatusHidden ||
			!view.ReviewPending || view.Edited || view.CreatorID != author || view.Creator.ID != author || !sameJSON(t, view.Note, note) || view.Created.IsZero() {
			t.Fatalf("unexpected view %+v", view)
		}
		if !reflect.DeepEqual(view.Routes, routes) {
			t.Fatalf("routes are stored as written\n got %+v\nwant %+v", view.Routes, routes)
		}
		shorter := routes[1:]
		if err := env.Repo.Update(ctx, created.ID, walkthrough.Changes{Routes: shorter, Text: "new", Status: walkthrough.StatusDraft}); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Lock(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Text != "new" || got.Lang != nil || got.Note != nil || got.Status != walkthrough.StatusDraft || got.ReviewPending || !got.Edited || !reflect.DeepEqual(got.Routes, shorter) {
			t.Fatalf("unexpected walkthrough after update %+v", got)
		}
		if err := env.Repo.Update(ctx, created.ID, walkthrough.Changes{Note: note, Status: walkthrough.StatusDraft}); err != nil {
			t.Fatal(err)
		}
		if bare, _ := env.Repo.Get(ctx, created.ID); len(bare.Routes) != 0 || !sameJSON(t, bare.Note, note) {
			t.Fatalf("a walkthrough may hold a note alone: %+v", bare)
		}
		if err := env.Repo.MarkReviewPending(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SetStatus(ctx, created.ID, walkthrough.StatusDeleted); err != nil {
			t.Fatal(err)
		}
		if got, _ := env.Repo.Get(ctx, created.ID); got.Status != walkthrough.StatusDeleted || got.ReviewPending {
			t.Fatalf("status not updated: %+v", got)
		}
	})

	t.Run("an author has one walkthrough per game", func(t *testing.T) {
		env := newEnv(t)
		author, other, gameID := env.NewUser(t), env.NewUser(t), env.NewGame(t)
		first := create(ctx, t, env, gameID, author, walkthrough.StatusDraft, day)
		if _, err := env.Repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Text: "again", Status: walkthrough.StatusDraft, CreatorID: author}); !errors.Is(err, walkthrough.ErrAlreadyWritten) {
			t.Fatalf("second walkthrough of the same author: %v", err)
		}
		create(ctx, t, env, gameID, other, walkthrough.StatusDraft, day)
		create(ctx, t, env, env.NewGame(t), author, walkthrough.StatusDraft, day)

		locked, err := env.Repo.LockWritten(ctx, gameID, author)
		if err != nil || locked.ID != first.ID || !reflect.DeepEqual(locked.Routes, routes) {
			t.Fatalf("lock written %+v %v", locked, err)
		}
		written, err := env.Repo.Written(ctx, gameID, author)
		if err != nil || written.ID != first.ID || written.RouteCount != len(routes) || written.Status != walkthrough.StatusDraft || written.Creator.ID != author || written.GameID != gameID {
			t.Fatalf("written %+v %v", written, err)
		}

		if err := env.Repo.SetStatus(ctx, first.ID, walkthrough.StatusDeleted); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Written(ctx, gameID, author); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("a deleted walkthrough is not the written one: %v", err)
		}
		again := create(ctx, t, env, gameID, author, walkthrough.StatusDraft, day)
		if locked, err := env.Repo.LockWritten(ctx, gameID, author); err != nil || locked.ID != again.ID {
			t.Fatalf("a new walkthrough may follow a deleted one: %+v %v", locked, err)
		}
	})

	t.Run("game listings hold what is published, latest update first", func(t *testing.T) {
		env := newEnv(t)
		gameID := env.NewGame(t)
		old := create(ctx, t, env, gameID, env.NewUser(t), walkthrough.StatusPublished, day)
		latest := create(ctx, t, env, gameID, env.NewUser(t), walkthrough.StatusPublished, day.Add(2*time.Hour))
		middle := create(ctx, t, env, gameID, env.NewUser(t), walkthrough.StatusPublished, day.Add(time.Hour))
		create(ctx, t, env, gameID, env.NewUser(t), walkthrough.StatusDraft, day.Add(3*time.Hour))
		create(ctx, t, env, gameID, env.NewUser(t), walkthrough.StatusHidden, day.Add(3*time.Hour))
		create(ctx, t, env, gameID, env.NewUser(t), walkthrough.StatusDeleted, day.Add(3*time.Hour))
		create(ctx, t, env, env.NewGame(t), env.NewUser(t), walkthrough.StatusPublished, day.Add(3*time.Hour))

		listed, err := env.Repo.ListPublished(ctx, gameID, 10)
		if err != nil || !reflect.DeepEqual(ids(listed), []int{latest.ID, middle.ID, old.ID}) {
			t.Fatalf("listing %v %v", ids(listed), err)
		}
		if listed[0].RouteCount != len(routes) || listed[0].Creator.ID == 0 || !listed[0].Updated.Equal(day.Add(2*time.Hour)) || listed[0].GameID != gameID {
			t.Fatalf("unexpected summary %+v", listed[0])
		}
		if capped, _ := env.Repo.ListPublished(ctx, gameID, 2); !reflect.DeepEqual(ids(capped), []int{latest.ID, middle.ID}) {
			t.Fatalf("capped listing %v", ids(capped))
		}
	})

	t.Run("creator listings filter statuses and rated games, unpublished first", func(t *testing.T) {
		env := newEnv(t)
		author := env.NewUser(t)
		first := create(ctx, t, env, env.NewGame(t), author, walkthrough.StatusPublished, day)
		onRated := create(ctx, t, env, env.NewRatedGame(t), author, walkthrough.StatusPublished, day.Add(time.Hour))
		draft := create(ctx, t, env, env.NewGame(t), author, walkthrough.StatusDraft, day.Add(-time.Hour))
		hidden := create(ctx, t, env, env.NewGame(t), author, walkthrough.StatusHidden, day.Add(-2*time.Hour))
		create(ctx, t, env, env.NewGame(t), author, walkthrough.StatusDeleted, day)
		create(ctx, t, env, env.NewGame(t), env.NewUser(t), walkthrough.StatusPublished, day)

		page := walkthrough.Page{Number: 1, Size: 10}
		public, total, err := env.Repo.ListByCreator(ctx, walkthrough.CreatorFilter{CreatorID: author, Statuses: []walkthrough.Status{walkthrough.StatusPublished}}, page)
		if err != nil || total != 2 || !reflect.DeepEqual(ids(public), []int{onRated.ID, first.ID}) {
			t.Fatalf("public listing %v %v", ids(public), err)
		}
		own := []walkthrough.Status{walkthrough.StatusPublished, walkthrough.StatusDraft, walkthrough.StatusHidden}
		all, total, _ := env.Repo.ListByCreator(ctx, walkthrough.CreatorFilter{CreatorID: author, Statuses: own}, page)
		if total != 4 || !reflect.DeepEqual(ids(all), []int{draft.ID, hidden.ID, onRated.ID, first.ID}) {
			t.Fatalf("own listing %v", ids(all))
		}
		strict, total, _ := env.Repo.ListByCreator(ctx, walkthrough.CreatorFilter{CreatorID: author, Statuses: own, ExcludeRated: true}, walkthrough.Page{Number: 2, Size: 2})
		if total != 3 || !reflect.DeepEqual(ids(strict), []int{first.ID}) || strict[0].RouteCount != len(routes) || strict[0].Creator.ID != author {
			t.Fatalf("strict listing %v", ids(strict))
		}
	})
}
