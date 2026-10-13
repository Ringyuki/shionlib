package commenttest

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Env struct {
	Repo         comment.Repository
	NewUser      func(t *testing.T) int
	NewGame      func(t *testing.T) int
	NewRatedGame func(t *testing.T) int
	NewResource  func(t *testing.T, gameID, creatorID int, public bool) int
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
	if in.Text == "" {
		in.Text = "hi"
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
		if err := env.Repo.UpdateContent(ctx, 987654, content, ""); !errors.Is(err, comment.ErrNotFound) {
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
		if _, err := env.Repo.Create(ctx, comment.NewComment{Content: content, Text: "", GameID: env.NewGame(t), CreatorID: env.NewUser(t), ParentID: &missing, RootID: &missing}); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("create under missing parent: %v", err)
		}
		if _, err := env.Repo.Create(ctx, comment.NewComment{Content: content, Text: "", GameID: 987654, CreatorID: env.NewUser(t)}); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("create for missing game: %v", err)
		}
	})

	t.Run("create stores a pending comment", func(t *testing.T) {
		env := newEnv(t)
		author, gameID := env.NewUser(t), env.NewGame(t)
		created := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author, Text: "hi"})
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.ID != created.ID || got.GameID != gameID || got.CreatorID != author || got.Status != comment.StatusPending || got.Edited || got.ReplyCount != 0 ||
			got.ParentID != nil || got.RootID != nil || got.Text != "hi" || !sameJSON(t, got.Content, content) || got.Created.IsZero() {
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
		if entry.Creator.ID != replier || entry.Parent == nil || entry.Parent.ID != root.ID || entry.Parent.Creator.ID != author || entry.Parent.Text != "hi" {
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
		if err := env.Repo.UpdateContent(ctx, created.ID, edited, "new"); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Get(ctx, created.ID)
		if !got.Edited || got.Status != comment.StatusPending || got.Text != "new" || !sameJSON(t, got.Content, edited) {
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

		reply := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: viewer, ParentID: &visible.ID, RootID: &visible.ID})
		_ = env.Repo.SetStatus(ctx, reply.ID, comment.StatusVisible)
		nested := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author, ParentID: &reply.ID, RootID: &visible.ID})
		_ = env.Repo.SetStatus(ctx, nested.ID, comment.StatusVisible)
		create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author, ParentID: &visible.ID, RootID: &visible.ID})
		orphan := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author, RootID: &visible.ID})
		_ = env.Repo.SetStatus(ctx, orphan.ID, comment.StatusVisible)
		_ = env.Repo.SetRoot(ctx, visible.ID, visible.ID)

		threads, totals, err := env.Repo.ListThreads(ctx, comment.Subject{GameID: gameID}, viewer, comment.OrderNewest, comment.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if totals != (comment.ThreadTotals{Threads: 2, Comments: 5}) || len(threads) != 2 || threads[0].ID != ownPending.ID || threads[1].ID != visible.ID {
			t.Fatalf("unexpected threads totals=%+v %+v", totals, threads)
		}
		if replies := threads[1].Replies; len(replies) != 3 || replies[0].ID != reply.ID || replies[1].ID != nested.ID || replies[2].ID != orphan.ID || len(threads[0].Replies) != 0 {
			t.Fatalf("a thread holds its visible replies oldest first, also replies to replies and replies whose parent is gone: %+v", threads)
		}
		if parent := threads[1].Replies[1].Parent; parent == nil || parent.ID != reply.ID || parent.Creator.ID != viewer {
			t.Fatalf("a reply names the comment it answers: %+v", threads[1].Replies[1])
		}
		oldest, _, _ := env.Repo.ListThreads(ctx, comment.Subject{GameID: gameID}, viewer, comment.OrderOldest, comment.Page{Number: 1, Size: 10})
		if len(oldest) != 2 || oldest[0].ID != visible.ID || oldest[1].ID != ownPending.ID {
			t.Fatalf("oldest first: %+v", oldest)
		}
		guest, totals, _ := env.Repo.ListThreads(ctx, comment.Subject{GameID: gameID}, 0, comment.OrderNewest, comment.Page{Number: 1, Size: 10})
		if totals != (comment.ThreadTotals{Threads: 1, Comments: 4}) || guest[0].ID != visible.ID || len(guest[0].Replies) != 3 {
			t.Fatalf("guests only see visible comments: %+v %+v", totals, guest)
		}
		second, totals, _ := env.Repo.ListThreads(ctx, comment.Subject{GameID: gameID}, viewer, comment.OrderNewest, comment.Page{Number: 2, Size: 1})
		if totals.Threads != 2 || len(second) != 1 || second[0].ID != visible.ID || len(second[0].Replies) != 3 {
			t.Fatalf("unexpected second page %+v", second)
		}
		if none, totals, err := env.Repo.ListThreads(ctx, comment.Subject{GameID: otherGame + gameID + 1000}, 0, comment.OrderNewest, comment.Page{Number: 1, Size: 10}); err != nil || len(none) != 0 || totals != (comment.ThreadTotals{}) {
			t.Fatalf("a game without comments: %+v %+v %v", none, totals, err)
		}
		for aimed, want := range map[int]int{ownPending.ID: 0, visible.ID: 1, nested.ID: 1} {
			if index, found, err := env.Repo.ThreadIndex(ctx, comment.Subject{GameID: gameID}, viewer, aimed, comment.OrderNewest); err != nil || !found || index != want {
				t.Fatalf("comment %d sits in thread %d: %d %v %v", aimed, want, index, found, err)
			}
		}
		if index, found, _ := env.Repo.ThreadIndex(ctx, comment.Subject{GameID: gameID}, viewer, nested.ID, comment.OrderOldest); !found || index != 0 {
			t.Fatalf("oldest first puts the first thread first: %d %v", index, found)
		}
		if _, found, err := env.Repo.ThreadIndex(ctx, comment.Subject{GameID: gameID}, 0, ownPending.ID, comment.OrderNewest); err != nil || found {
			t.Fatalf("a comment the viewer cannot see has no place: %v %v", found, err)
		}
		if _, found, err := env.Repo.ThreadIndex(ctx, comment.Subject{GameID: otherGame}, viewer, visible.ID, comment.OrderNewest); err != nil || found {
			t.Fatalf("a comment of another game has no place: %v %v", found, err)
		}
	})

	t.Run("a resource has its own threads with the pinned one first", func(t *testing.T) {
		env := newEnv(t)
		gameID := env.NewGame(t)
		publisher, visitor := env.NewUser(t), env.NewUser(t)
		resourceID, sibling := env.NewResource(t, gameID, publisher, true), env.NewResource(t, gameID, publisher, true)
		subject := comment.Subject{GameID: gameID, ResourceID: resourceID}
		everything := comment.Page{Number: 1, Size: 10}
		shown := func(in comment.NewComment) comment.Comment {
			created := create(ctx, t, env.Repo, in)
			_ = env.Repo.SetStatus(ctx, created.ID, comment.StatusVisible)
			_ = env.Repo.SetRoot(ctx, created.ID, created.ID)
			return created
		}
		onGame := shown(comment.NewComment{GameID: gameID, CreatorID: visitor})
		first := shown(comment.NewComment{GameID: gameID, ResourceID: &resourceID, CreatorID: visitor})
		second := shown(comment.NewComment{GameID: gameID, ResourceID: &resourceID, CreatorID: publisher})
		third := shown(comment.NewComment{GameID: gameID, ResourceID: &resourceID, CreatorID: visitor})
		elsewhere := shown(comment.NewComment{GameID: gameID, ResourceID: &sibling, CreatorID: visitor})
		answer := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, ResourceID: &resourceID, CreatorID: publisher, ParentID: &first.ID, RootID: &first.ID})
		_ = env.Repo.SetStatus(ctx, answer.ID, comment.StatusVisible)

		if stored, _ := env.Repo.Get(ctx, first.ID); stored.ResourceID == nil || *stored.ResourceID != resourceID || stored.Pinned() {
			t.Fatalf("a comment remembers its resource: %+v", stored)
		}
		ofGame, totals, err := env.Repo.ListThreads(ctx, comment.Subject{GameID: gameID}, 0, comment.OrderNewest, everything)
		if err != nil || totals != (comment.ThreadTotals{Threads: 1, Comments: 1}) || ofGame[0].ID != onGame.ID {
			t.Fatalf("the game's own comments leave out those of its resources: %+v %+v %v", totals, ofGame, err)
		}
		ofResource, totals, err := env.Repo.ListThreads(ctx, subject, 0, comment.OrderNewest, everything)
		if err != nil || totals != (comment.ThreadTotals{Threads: 3, Comments: 4}) || ofResource[0].ID != third.ID || ofResource[2].ID != first.ID || len(ofResource[2].Replies) != 1 {
			t.Fatalf("a resource lists only its own threads: %+v %+v %v", totals, ofResource, err)
		}

		pinnedAt := first.Created.Add(time.Hour)
		if err := env.Repo.SetPin(ctx, first.ID, pinnedAt); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SetPin(ctx, elsewhere.ID, pinnedAt); err != nil {
			t.Fatalf("each resource has its own pinned comment: %v", err)
		}
		for _, order := range []comment.Order{comment.OrderNewest, comment.OrderOldest} {
			threads, totals, _ := env.Repo.ListThreads(ctx, subject, 0, order, everything)
			if threads[0].ID != first.ID || !threads[0].Pinned() || threads[1].Pinned() || totals.PinnedID != first.ID {
				t.Fatalf("%s: the pinned thread comes first whatever the order: %+v %+v", order, totals, threads)
			}
		}
		paged, totals, _ := env.Repo.ListThreads(ctx, subject, 0, comment.OrderNewest, comment.Page{Number: 2, Size: 1})
		if len(paged) != 1 || paged[0].ID != third.ID || totals.PinnedID != first.ID {
			t.Fatalf("pages follow the same order and every page names the pinned comment: %+v %+v", totals, paged)
		}
		if _, ofGame, _ := env.Repo.ListThreads(ctx, comment.Subject{GameID: gameID}, 0, comment.OrderNewest, everything); ofGame.PinnedID != 0 {
			t.Fatalf("a game has no pinned comment: %+v", ofGame)
		}
		for aimed, want := range map[int]int{first.ID: 0, answer.ID: 0, third.ID: 1, second.ID: 2} {
			if index, found, err := env.Repo.ThreadIndex(ctx, subject, 0, aimed, comment.OrderNewest); err != nil || !found || index != want {
				t.Fatalf("comment %d sits in thread %d: %d %v %v", aimed, want, index, found, err)
			}
		}
		if _, found, _ := env.Repo.ThreadIndex(ctx, subject, 0, onGame.ID, comment.OrderNewest); found {
			t.Fatal("a comment of the game has no place among the comments of its resource")
		}

		if err := env.Repo.ClearPin(ctx, resourceID); err != nil {
			t.Fatal(err)
		}
		cleared, _ := env.Repo.Get(ctx, first.ID)
		kept, _ := env.Repo.Get(ctx, elsewhere.ID)
		if cleared.Pinned() || !kept.Pinned() {
			t.Fatalf("unpinning touches one resource only: %+v %+v", cleared, kept)
		}
	})

	t.Run("creator listings name the resource and skip resources that are not public", func(t *testing.T) {
		env := newEnv(t)
		gameID := env.NewGame(t)
		author := env.NewUser(t)
		open, hidden := env.NewResource(t, gameID, author, true), env.NewResource(t, gameID, author, false)
		onGame := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, CreatorID: author})
		onOpen := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, ResourceID: &open, CreatorID: author})
		onHidden := create(ctx, t, env.Repo, comment.NewComment{GameID: gameID, ResourceID: &hidden, CreatorID: author})
		for _, id := range []int{onGame.ID, onOpen.ID, onHidden.ID} {
			_ = env.Repo.SetStatus(ctx, id, comment.StatusVisible)
		}
		listed, total, err := env.Repo.ListByCreator(ctx, comment.CreatorFilter{CreatorID: author}, comment.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if total != 2 || listed[0].ID != onOpen.ID || listed[1].ID != onGame.ID {
			t.Fatalf("comments on a resource nobody else can open are left out: %+v", listed)
		}
		if ref := listed[0].Resource; ref == nil || ref.ID != open || ref.GameID != gameID || listed[1].Resource != nil {
			t.Fatalf("a comment on a resource names it: %+v %+v", listed[0].Resource, listed[1].Resource)
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
		answer := create(ctx, t, env.Repo, comment.NewComment{GameID: safe, CreatorID: author, ParentID: &first.ID, RootID: &first.ID})
		_ = env.Repo.SetStatus(ctx, answer.ID, comment.StatusVisible)
		answered, _, err := env.Repo.ListByCreator(ctx, comment.CreatorFilter{CreatorID: author}, comment.Page{Number: 1, Size: 1})
		if err != nil {
			t.Fatal(err)
		}
		if quoted := answered[0].Parent; answered[0].ID != answer.ID || quoted == nil || quoted.ID != first.ID || !sameJSON(t, quoted.Content, content) {
			t.Fatalf("a reply carries the document of the comment it answers: %+v", answered[0])
		}
	})
}
