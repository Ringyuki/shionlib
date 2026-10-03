package commenttest

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Env struct {
	Repo         comment.Repository
	NewUser      func(t *testing.T) int
	NewGame      func(t *testing.T) int
	NewRatedGame func(t *testing.T) int
}

var content = json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hi"}]}]}}`)

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

func create(ctx context.Context, t *testing.T, repo comment.Repository, in comment.NewComment) comment.Comment {
	t.Helper()
	if in.Content == nil {
		in.Content = content
	}
	if in.HTML == "" {
		in.HTML = "<p>hi</p>"
	}
	created, err := repo.Create(ctx, in)
	if err != nil {
		t.Fatal(err)
	}
	return created
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("lock: %v", err)
		}
		if _, err := env.Repo.Entry(ctx, 987654, 0); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("entry: %v", err)
		}
		if err := env.Repo.UpdateContent(ctx, 987654, content, "<p></p>"); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("update content: %v", err)
		}
		if err := env.Repo.SetStatus(ctx, 987654, comment.StatusVisible); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("set status: %v", err)
		}
		if err := env.Repo.Delete(ctx, 987654); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("delete: %v", err)
		}
		if _, err := env.Repo.AddLike(ctx, 987654, env.NewUser(t)); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("like: %v", err)
		}
		if err := env.Repo.AdjustReplyCount(ctx, 987654, -1); err != nil {
			t.Fatalf("adjusting a vanished parent is a no-op: %v", err)
		}
		missing := 987654
		if _, err := env.Repo.Create(ctx, comment.NewComment{Content: content, HTML: "<p></p>", GameID: env.NewGame(t), CreatorID: env.NewUser(t), ParentID: &missing, RootID: &missing}); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("create under missing parent: %v", err)
		}
		if _, err := env.Repo.Create(ctx, comment.NewComment{Content: content, HTML: "<p></p>", GameID: 987654, CreatorID: env.NewUser(t)}); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("create for missing game: %v", err)
		}
	})

	t.Run("create stores a pending comment", func(t *testing.T) {
		env := newEnv(t)
		author, gameID := env.NewUser(t), env.NewGame(t)
		created := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author, HTML: "<p>hi</p>"})
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.ID != created.ID || got.GameID != gameID || got.CreatorID != author || got.Status != comment.StatusPending || got.Edited || got.ReplyCount != 0 ||
			got.ParentID != nil || got.RootID != nil || got.HTML == nil || *got.HTML != "<p>hi</p>" || !sameJSON(t, got.Content, content) || got.Created.IsZero() {
			t.Fatalf("unexpected comment %+v", got)
		}
	})

	t.Run("threads keep roots and reply counts", func(t *testing.T) {
		env := newEnv(t)
		author, replier, gameID := env.NewUser(t), env.NewUser(t), env.NewGame(t)
		root := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author})
		if err := env.Repo.SetRoot(ctx, root.ID, root.ID); err != nil {
			t.Fatal(err)
		}
		reply := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: replier, ParentID: &root.ID, RootID: &root.ID})
		if err := env.Repo.AdjustReplyCount(ctx, root.ID, 1); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Get(ctx, root.ID)
		if got.RootID == nil || *got.RootID != root.ID || got.ReplyCount != 1 {
			t.Fatalf("unexpected root %+v", got)
		}
		for range 2 {
			if err := env.Repo.AdjustReplyCount(ctx, root.ID, -1); err != nil {
				t.Fatal(err)
			}
		}
		if got, _ := env.Repo.Get(ctx, root.ID); got.ReplyCount != 0 {
			t.Fatalf("reply counts never go negative: %d", got.ReplyCount)
		}
		entry, err := env.Repo.Entry(ctx, reply.ID, 0)
		if err != nil {
			t.Fatal(err)
		}
		if entry.Creator.ID != replier || entry.Parent == nil || entry.Parent.ID != root.ID || entry.Parent.Creator.ID != author || entry.Parent.HTML == nil || *entry.Parent.HTML != "<p>hi</p>" {
			t.Fatalf("unexpected entry %+v", entry)
		}
		if err := env.Repo.Delete(ctx, root.ID); err != nil {
			t.Fatal(err)
		}
		orphan, err := env.Repo.Get(ctx, reply.ID)
		if err != nil {
			t.Fatal(err)
		}
		if orphan.ParentID != nil || orphan.RootID != nil {
			t.Fatalf("deleting a parent detaches replies: %+v", orphan)
		}
	})

	t.Run("content edits reset moderation", func(t *testing.T) {
		env := newEnv(t)
		created := create(ctx, t, env.Repo, comment.NewComment{GameID: env.NewGame(t), CreatorID: env.NewUser(t)})
		if err := env.Repo.SetStatus(ctx, created.ID, comment.StatusBlocked); err != nil {
			t.Fatal(err)
		}
		edited := json.RawMessage(`{"root":{"type":"root","children":[]}}`)
		if err := env.Repo.UpdateContent(ctx, created.ID, edited, "<p>new</p>"); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Get(ctx, created.ID)
		if !got.Edited || got.Status != comment.StatusPending || *got.HTML != "<p>new</p>" || !sameJSON(t, got.Content, edited) {
			t.Fatalf("unexpected edited comment %+v", got)
		}
	})

	t.Run("likes are toggled per user", func(t *testing.T) {
		env := newEnv(t)
		created := create(ctx, t, env.Repo, comment.NewComment{GameID: env.NewGame(t), CreatorID: env.NewUser(t)})
		fan, other := env.NewUser(t), env.NewUser(t)
		if added, err := env.Repo.AddLike(ctx, created.ID, fan); err != nil || !added {
			t.Fatalf("first like: %v %v", added, err)
		}
		if added, err := env.Repo.AddLike(ctx, created.ID, fan); err != nil || added {
			t.Fatalf("duplicate like must be ignored: %v %v", added, err)
		}
		if _, err := env.Repo.AddLike(ctx, created.ID, other); err != nil {
			t.Fatal(err)
		}
		if liked, err := env.Repo.HasLike(ctx, created.ID, fan); err != nil || !liked {
			t.Fatalf("has like: %v %v", liked, err)
		}
		entry, _ := env.Repo.Entry(ctx, created.ID, fan)
		if entry.LikeCount != 2 || !entry.Liked {
			t.Fatalf("unexpected like state %+v", entry)
		}
		if err := env.Repo.RemoveLike(ctx, created.ID, fan); err != nil {
			t.Fatal(err)
		}
		entry, _ = env.Repo.Entry(ctx, created.ID, fan)
		if entry.LikeCount != 1 || entry.Liked {
			t.Fatalf("unexpected like state after unlike %+v", entry)
		}
		if guest, _ := env.Repo.Entry(ctx, created.ID, 0); guest.Liked {
			t.Fatal("guests never like")
		}
	})

	t.Run("game listings show visible comments and the viewer's own pending ones oldest first", func(t *testing.T) {
		env := newEnv(t)
		gameID, otherGame := env.NewGame(t), env.NewGame(t)
		author, viewer := env.NewUser(t), env.NewUser(t)
		visible := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author})
		_ = env.Repo.SetStatus(ctx, visible.ID, comment.StatusVisible)
		create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author})
		ownPending := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: viewer})
		ownBlocked := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: viewer})
		_ = env.Repo.SetStatus(ctx, ownBlocked.ID, comment.StatusBlocked)
		elsewhere := create(ctx, t, env.Repo, comment.NewComment{GameID: otherGame, CreatorID: author})
		_ = env.Repo.SetStatus(ctx, elsewhere.ID, comment.StatusVisible)

		entries, total, err := env.Repo.ListByGame(ctx, gameID, viewer, comment.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if total != 2 || len(entries) != 2 || entries[0].ID != visible.ID || entries[1].ID != ownPending.ID {
			t.Fatalf("unexpected listing total=%d %+v", total, entries)
		}
		guest, total, _ := env.Repo.ListByGame(ctx, gameID, 0, comment.Page{Number: 1, Size: 10})
		if total != 1 || guest[0].ID != visible.ID {
			t.Fatalf("guests only see visible comments: %+v", guest)
		}
		second, total, _ := env.Repo.ListByGame(ctx, gameID, viewer, comment.Page{Number: 2, Size: 1})
		if total != 2 || len(second) != 1 || second[0].ID != ownPending.ID {
			t.Fatalf("unexpected second page %+v", second)
		}
	})

	t.Run("creator listings show visible comments newest first and can exclude rated games", func(t *testing.T) {
		env := newEnv(t)
		author := env.NewUser(t)
		safe, rated := env.NewGame(t), env.NewRatedGame(t)
		first := create(ctx, t, env.Repo, comment.NewComment{GameID: safe, CreatorID: author})
		onRated := create(ctx, t, env.Repo, comment.NewComment{GameID: rated, CreatorID: author})
		last := create(ctx, t, env.Repo, comment.NewComment{GameID: safe, CreatorID: author})
		hidden := create(ctx, t, env.Repo, comment.NewComment{GameID: safe, CreatorID: author})
		for _, id := range []int{first.ID, onRated.ID, last.ID} {
			_ = env.Repo.SetStatus(ctx, id, comment.StatusVisible)
		}
		_ = hidden

		all, total, err := env.Repo.ListByCreator(ctx, comment.CreatorFilter{CreatorID: author}, comment.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if total != 3 || all[0].ID != last.ID || all[1].ID != onRated.ID || all[2].ID != first.ID {
			t.Fatalf("unexpected creator listing %+v", all)
		}
		strict, total, err := env.Repo.ListByCreator(ctx, comment.CreatorFilter{CreatorID: author, ExcludeRated: true}, comment.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if total != 2 || strict[0].ID != last.ID || strict[1].ID != first.ID {
			t.Fatalf("rated games must be excluded: %+v", strict)
		}
	})
}
