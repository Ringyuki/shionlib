package walkthroughtest

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type Env struct {
	Repo         walkthrough.Repository
	NewUser      func(t *testing.T) int
	NewGame      func(t *testing.T) int
	NewRatedGame func(t *testing.T) int
}

var content = json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"guide"}]}]}}`)

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

func create(ctx context.Context, t *testing.T, repo walkthrough.Repository, gameID, creatorID int, status walkthrough.Status) walkthrough.Walkthrough {
	t.Helper()
	created, err := repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Title: "Guide", Content: content, HTML: "<p>guide</p>", Status: status, CreatorID: creatorID})
	if err != nil {
		t.Fatal(err)
	}
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
		if _, err := env.Repo.View(ctx, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("view: %v", err)
		}
		if err := env.Repo.Update(ctx, 987654, walkthrough.Changes{Title: "x", Content: content, HTML: "x", Status: walkthrough.StatusDraft}); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("update: %v", err)
		}
		if err := env.Repo.SetStatus(ctx, 987654, walkthrough.StatusDeleted); !errors.Is(err, walkthrough.ErrNotFound) {
			t.Fatalf("set status: %v", err)
		}
		if _, err := env.Repo.Create(ctx, walkthrough.NewWalkthrough{GameID: 987654, Title: "x", Content: content, HTML: "x", Status: walkthrough.StatusDraft, CreatorID: env.NewUser(t)}); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("create for missing game: %v", err)
		}
	})

	t.Run("create, view and update", func(t *testing.T) {
		env := newEnv(t)
		author, gameID := env.NewUser(t), env.NewGame(t)
		lang := "jp"
		created, err := env.Repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Title: "攻略", Content: content, HTML: "<p>guide</p>", Lang: &lang, Status: walkthrough.StatusHidden, CreatorID: author})
		if err != nil {
			t.Fatal(err)
		}
		view, err := env.Repo.View(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if view.ID != created.ID || view.GameID != gameID || view.Title != "攻略" || view.HTML != "<p>guide</p>" || view.Lang == nil || *view.Lang != "jp" ||
			view.Status != walkthrough.StatusHidden || view.Edited || view.CreatorID != author || view.Creator.ID != author || !sameJSON(t, view.Content, content) || view.Created.IsZero() {
			t.Fatalf("unexpected view %+v", view)
		}
		edited := json.RawMessage(`{"root":{"type":"root","children":[]}}`)
		if err := env.Repo.Update(ctx, created.ID, walkthrough.Changes{Title: "New", Content: edited, HTML: "<p>new</p>", Status: walkthrough.StatusDraft}); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Lock(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Title != "New" || got.HTML != "<p>new</p>" || got.Lang != nil || got.Status != walkthrough.StatusDraft || !got.Edited || !sameJSON(t, got.Content, edited) {
			t.Fatalf("unexpected walkthrough after update %+v", got)
		}
		if err := env.Repo.SetStatus(ctx, created.ID, walkthrough.StatusDeleted); err != nil {
			t.Fatal(err)
		}
		if got, _ := env.Repo.Get(ctx, created.ID); got.Status != walkthrough.StatusDeleted {
			t.Fatalf("status not updated: %+v", got)
		}
	})

	t.Run("game listings apply visibility newest first", func(t *testing.T) {
		env := newEnv(t)
		gameID, author, viewer := env.NewGame(t), env.NewUser(t), env.NewUser(t)
		published := create(ctx, t, env.Repo, gameID, author, walkthrough.StatusPublished)
		draft := create(ctx, t, env.Repo, gameID, author, walkthrough.StatusDraft)
		create(ctx, t, env.Repo, gameID, author, walkthrough.StatusHidden)
		ownHidden := create(ctx, t, env.Repo, gameID, viewer, walkthrough.StatusHidden)
		create(ctx, t, env.Repo, gameID, viewer, walkthrough.StatusDeleted)
		create(ctx, t, env.Repo, env.NewGame(t), author, walkthrough.StatusPublished)

		page := walkthrough.Page{Number: 1, Size: 10}
		guest, total, err := env.Repo.ListByGame(ctx, walkthrough.GameFilter{GameID: gameID, Public: []walkthrough.Status{walkthrough.StatusPublished}}, page)
		if err != nil || total != 1 || !reflect.DeepEqual(ids(guest), []int{published.ID}) {
			t.Fatalf("guest listing %v %d %v", ids(guest), total, err)
		}
		own, total, _ := env.Repo.ListByGame(ctx, walkthrough.GameFilter{GameID: gameID, Public: []walkthrough.Status{walkthrough.StatusPublished}, ViewerID: viewer}, page)
		if total != 2 || !reflect.DeepEqual(ids(own), []int{ownHidden.ID, published.ID}) {
			t.Fatalf("viewer listing %v", ids(own))
		}
		staff, total, _ := env.Repo.ListByGame(ctx, walkthrough.GameFilter{GameID: gameID, Public: []walkthrough.Status{walkthrough.StatusPublished, walkthrough.StatusDraft}, ViewerID: 987654}, page)
		if total != 2 || !reflect.DeepEqual(ids(staff), []int{draft.ID, published.ID}) {
			t.Fatalf("staff listing %v", ids(staff))
		}
		hidden := walkthrough.StatusHidden
		filtered, total, _ := env.Repo.ListByGame(ctx, walkthrough.GameFilter{GameID: gameID, Status: &hidden, Public: []walkthrough.Status{walkthrough.StatusPublished}, ViewerID: viewer}, page)
		if total != 1 || !reflect.DeepEqual(ids(filtered), []int{ownHidden.ID}) {
			t.Fatalf("status filter %v", ids(filtered))
		}
		second, total, _ := env.Repo.ListByGame(ctx, walkthrough.GameFilter{GameID: gameID, Public: []walkthrough.Status{walkthrough.StatusPublished}, ViewerID: viewer}, walkthrough.Page{Number: 2, Size: 1})
		if total != 2 || !reflect.DeepEqual(ids(second), []int{published.ID}) || second[0].Creator.ID != author || second[0].Title != "Guide" {
			t.Fatalf("second page %+v", second)
		}
	})

	t.Run("creator listings filter statuses and rated games", func(t *testing.T) {
		env := newEnv(t)
		author := env.NewUser(t)
		safe, rated := env.NewGame(t), env.NewRatedGame(t)
		first := create(ctx, t, env.Repo, safe, author, walkthrough.StatusPublished)
		onRated := create(ctx, t, env.Repo, rated, author, walkthrough.StatusPublished)
		draft := create(ctx, t, env.Repo, safe, author, walkthrough.StatusDraft)

		page := walkthrough.Page{Number: 1, Size: 10}
		public, total, err := env.Repo.ListByCreator(ctx, walkthrough.CreatorFilter{CreatorID: author, Statuses: []walkthrough.Status{walkthrough.StatusPublished}}, page)
		if err != nil || total != 2 || !reflect.DeepEqual(ids(public), []int{onRated.ID, first.ID}) {
			t.Fatalf("public listing %v %v", ids(public), err)
		}
		strict, total, _ := env.Repo.ListByCreator(ctx, walkthrough.CreatorFilter{CreatorID: author, Statuses: []walkthrough.Status{walkthrough.StatusPublished, walkthrough.StatusDraft}, ExcludeRated: true}, page)
		if total != 2 || !reflect.DeepEqual(ids(strict), []int{draft.ID, first.ID}) {
			t.Fatalf("strict listing %v", ids(strict))
		}
	})
}
