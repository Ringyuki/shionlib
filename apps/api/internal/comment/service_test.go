package comment_test

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment/commenttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/message/messagetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	alice = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	bob   = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
)

const gameID = 7

type resources map[int]comment.ResourceRef

func (r resources) Viewable(_ context.Context, viewer actor.Actor, id int) (comment.ResourceRef, error) {
	ref, ok := r[id]
	if !ok || len(ref.FileNames) == 0 && ref.CreatorID != viewer.UserID {
		return comment.ResourceRef{}, download.ErrResourceNotFound
	}
	return ref, nil
}

type fixture struct {
	repo      *commenttest.MemoryRepository
	queue     *moderationtest.Queue
	messages  *moderationtest.Messages
	resources resources
	now       time.Time
	service   *comment.Service
	pins      *comment.PinService
}

func newFixture(cards ...game.Card) fixture {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo := commenttest.NewMemoryRepository(func() time.Time {
		clock = clock.Add(time.Second)
		return clock
	})
	repo.AddGame(gameID, false)
	f := fixture{repo: repo, queue: &moderationtest.Queue{}, messages: &moderationtest.Messages{}, resources: resources{}, now: time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)}
	f.service = comment.NewService(comment.Deps{
		Repo:      repo,
		Games:     gametest.NewCards(cards...),
		Resources: f.resources,
		Messages:  f.messages,
		Queue:     f.queue,
		Tx:        &txtest.Immediate{},
	})
	f.pins = comment.NewPinService(repo, f.resources, &txtest.Immediate{}, func() time.Time { return f.now })
	return f
}

func document(t *testing.T, texts ...string) richtext.Document {
	t.Helper()
	blocks := make([]any, len(texts))
	for i, text := range texts {
		blocks[i] = map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": text}}}
	}
	raw, _ := json.Marshal(map[string]any{"type": "doc", "content": blocks})
	doc, err := richtext.Parse(raw, richtext.Comment)
	if err != nil {
		t.Fatal(err)
	}
	return doc
}

func ptr[T any](v T) *T {
	return &v
}

func (f fixture) count(t *testing.T, id int) int {
	t.Helper()
	c, err := f.repo.Get(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return c.ReplyCount
}

func TestCreateRootComment(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "hello")})
	if err != nil {
		t.Fatal(err)
	}
	if created.Status != comment.StatusPending || created.CreatorID != alice.UserID || created.GameID != gameID || created.RootID == nil || *created.RootID != created.ID ||
		created.Parent != nil || created.LikeCount != 0 || created.Text != "hello" {
		t.Fatalf("unexpected comment %+v", created)
	}
	if jobs := f.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ScreenComment{CommentID: created.ID}) {
		t.Fatalf("expected a screening job, got %+v", jobs)
	}
	zero, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "x"), ParentID: ptr(0)})
	if err != nil || zero.ParentID != nil || *zero.RootID != zero.ID {
		t.Fatalf("parent_id 0 creates a root comment: %+v %v", zero, err)
	}
}

func TestRepliesCountOncePerAncestor(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	root, _ := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "root")})
	reply, err := f.service.Create(ctx, bob, gameID, comment.CreateInput{Content: document(t, "reply"), ParentID: &root.ID})
	if err != nil {
		t.Fatal(err)
	}
	if reply.Parent == nil || reply.Parent.ID != root.ID || *reply.RootID != root.ID || reply.Parent.Creator.ID != alice.UserID {
		t.Fatalf("unexpected reply %+v", reply)
	}
	if got := f.count(t, root.ID); got != 1 {
		t.Fatalf("a direct reply increments the root once, got %d", got)
	}
	deep, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "deep"), ParentID: &reply.ID})
	if err != nil {
		t.Fatal(err)
	}
	if *deep.RootID != root.ID || f.count(t, reply.ID) != 1 || f.count(t, root.ID) != 2 {
		t.Fatalf("deep reply counts: parent=%d root=%d", f.count(t, reply.ID), f.count(t, root.ID))
	}

	if err := f.service.Delete(ctx, alice, deep.ID); err != nil {
		t.Fatal(err)
	}
	if f.count(t, reply.ID) != 0 || f.count(t, root.ID) != 1 {
		t.Fatalf("deleting a deep reply: parent=%d root=%d", f.count(t, reply.ID), f.count(t, root.ID))
	}
	if err := f.service.Delete(ctx, bob, reply.ID); err != nil {
		t.Fatal(err)
	}
	if got := f.count(t, root.ID); got != 0 {
		t.Fatalf("deleting a direct reply decrements the root once, got %d", got)
	}
}

func TestCreateValidatesTheParentAndContent(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.repo.AddGame(8, false)
	other, _ := f.service.Create(ctx, alice, 8, comment.CreateInput{Content: document(t, "elsewhere")})
	if _, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "x"), ParentID: ptr(999)}); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("missing parent: %v", err)
	}
	if _, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "x"), ParentID: &other.ID}); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("parent on another game: %v", err)
	}
	if _, err := f.service.Create(ctx, alice, 404, comment.CreateInput{Content: document(t, "x")}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	overlong := strings.Repeat("x", comment.MaxContentLength+1)
	if _, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, overlong)}); !errors.Is(err, comment.ErrContentTooLong) {
		t.Fatalf("text beyond the limit: %v", err)
	}
	f.queue.Err = errors.New("queue down")
	if _, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "x")}); err == nil {
		t.Fatal("enqueue failures are reported")
	}
}

func TestEditRawAndDeleteRequireOwnership(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created, _ := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "before")})
	_ = f.repo.SetStatus(ctx, created.ID, comment.StatusBlocked)

	if _, err := f.service.Edit(ctx, alice, 999, document(t, "x")); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("edit missing: %v", err)
	}
	if _, err := f.service.Edit(ctx, bob, created.ID, document(t, "x")); !errors.Is(err, comment.ErrNotOwner) {
		t.Fatalf("edit by stranger: %v", err)
	}
	edited, err := f.service.Edit(ctx, admin, created.ID, document(t, "after"))
	if err != nil {
		t.Fatal(err)
	}
	if !edited.Edited || edited.Status != comment.StatusPending || edited.Text != "after" || edited.Creator.ID != alice.UserID {
		t.Fatalf("unexpected edited comment %+v", edited)
	}
	if jobs := f.queue.All(); len(jobs) != 2 || jobs[1] != (moderation.ScreenComment{CommentID: created.ID}) {
		t.Fatalf("edits are screened again: %+v", jobs)
	}

	if _, err := f.service.Raw(ctx, alice, 999); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("raw missing: %v", err)
	}
	if _, err := f.service.Raw(ctx, bob, created.ID); !errors.Is(err, comment.ErrNotOwner) {
		t.Fatalf("raw by stranger: %v", err)
	}
	raw, err := f.service.Raw(ctx, alice, created.ID)
	if err != nil || raw.CreatorID != alice.UserID || !strings.Contains(string(raw.Content), "after") {
		t.Fatalf("raw: %+v %v", raw, err)
	}

	if err := f.service.Delete(ctx, alice, 999); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("delete missing: %v", err)
	}
	if err := f.service.Delete(ctx, bob, created.ID); !errors.Is(err, comment.ErrNotOwner) {
		t.Fatalf("delete by stranger: %v", err)
	}
	if err := f.service.Delete(ctx, alice, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Get(ctx, created.ID); !errors.Is(err, comment.ErrNotFound) {
		t.Fatal("comments are hard deleted")
	}
}

type commitTracker struct {
	active   bool
	hooks    []func(context.Context)
	notifier *messagetest.RecordingNotifier
	before   int
}

func (c *commitTracker) WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	if c.active {
		return fn(ctx)
	}
	c.active = true
	err := fn(ctx)
	c.active = false
	c.before = len(c.notifier.Notices)
	if err != nil {
		c.hooks = nil
		return err
	}
	for _, hook := range c.hooks {
		hook(ctx)
	}
	c.hooks = nil
	return nil
}

func (c *commitTracker) AfterCommit(ctx context.Context, fn func(ctx context.Context)) {
	if c.active {
		c.hooks = append(c.hooks, fn)
		return
	}
	fn(ctx)
}

func TestToggleLikeNotifiesAfterCommit(t *testing.T) {
	ctx := context.Background()
	now := func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }
	repo := commenttest.NewMemoryRepository(now)
	repo.AddGame(gameID, false)
	notifier := &messagetest.RecordingNotifier{}
	tracker := &commitTracker{notifier: notifier}
	inbox := messagetest.NewMemoryRepository(now)
	messages := message.NewService(inbox, notifier, gametest.NewCards(), tracker, now)
	service := comment.NewService(comment.Deps{Repo: repo, Games: gametest.NewCards(), Messages: messages, Queue: &moderationtest.Queue{}, Tx: tracker})

	target := repo.Seed(comment.Comment{GameID: gameID, CreatorID: alice.UserID, Status: comment.StatusVisible})
	if err := service.ToggleLike(ctx, bob, 999); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("like missing: %v", err)
	}
	if err := service.ToggleLike(ctx, bob, target.ID); err != nil {
		t.Fatal(err)
	}
	if tracker.before != 0 || len(notifier.Notices) != 1 || notifier.Notices[0].UserID != alice.UserID || notifier.Notices[0].Notice.Type != message.TypeCommentLike {
		t.Fatalf("the like notice must be pushed after commit: before=%d %+v", tracker.before, notifier.Notices)
	}
	stored, _, _ := inbox.List(ctx, alice.UserID, message.Filter{}, message.Page{Number: 1, Size: 10})
	if len(stored) != 1 || stored[0].Title != "Messages.Comment.Like.Title" || *stored[0].CommentID != target.ID || *stored[0].GameID != gameID || stored[0].Sender == nil || stored[0].Sender.ID != bob.UserID {
		t.Fatalf("unexpected stored notice %+v", stored)
	}
	if liked, _ := repo.HasLike(ctx, target.ID, bob.UserID); !liked {
		t.Fatal("like not stored")
	}
	if err := service.ToggleLike(ctx, bob, target.ID); err != nil {
		t.Fatal(err)
	}
	if liked, _ := repo.HasLike(ctx, target.ID, bob.UserID); liked || len(notifier.Notices) != 1 {
		t.Fatal("unlike removes the like without a notice")
	}
	if err := service.ToggleLike(ctx, alice, target.ID); err != nil {
		t.Fatal(err)
	}
	if len(notifier.Notices) != 1 {
		t.Fatal("liking your own comment does not notify")
	}
}

func TestListByCreatorAttachesGameCardsForTheViewer(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: gameID, TitleJP: "ゲーム", Covers: []game.Cover{{URL: "safe"}, {URL: "rated", Sexual: 1}}})
	f.repo.AddGame(9, false)
	first := f.repo.Seed(comment.Comment{GameID: gameID, CreatorID: alice.UserID, Status: comment.StatusVisible})
	second := f.repo.Seed(comment.Comment{GameID: 9, CreatorID: alice.UserID, Status: comment.StatusVisible})

	entries, total, err := f.service.ListByCreator(ctx, alice, alice.UserID, comment.Page{Number: 1, Size: 10})
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 || entries[0].ID != second.ID || entries[1].ID != first.ID {
		t.Fatalf("unexpected entries %+v", entries)
	}
	if entries[1].Game == nil || entries[1].Game.TitleJP != "ゲーム" || len(entries[1].Game.Covers) != 1 {
		t.Fatalf("strict viewers get safe covers only: %+v", entries[1].Game)
	}
	if entries[0].Game == nil || entries[0].Game.ID != 9 {
		t.Fatalf("games without cards keep their id: %+v", entries[0].Game)
	}
	if rich, _, _ := f.service.ListByCreator(ctx, bob, alice.UserID, comment.Page{Number: 1, Size: 10}); len(rich[1].Game.Covers) != 2 {
		t.Fatalf("rated viewers see every cover: %+v", rich[1].Game)
	}
}

type stubStore struct {
	activity bool
	notice   bool
}

func (s *stubStore) Search(context.Context, comment.AdminFilter, comment.Page) ([]comment.AdminEntry, int, error) {
	return nil, 0, nil
}

func (s *stubStore) Detail(context.Context, int) (comment.AdminDetail, error) {
	return comment.AdminDetail{}, comment.ErrNotFound
}

func (s *stubStore) HasActivity(context.Context, int) (bool, error) {
	return s.activity, nil
}

func (s *stubStore) HasReplyNotice(context.Context, int, int) (bool, error) {
	return s.notice, nil
}

func TestAdminStatusChanges(t *testing.T) {
	ctx := context.Background()
	setup := func(store *stubStore) (*commenttest.MemoryRepository, *moderationtest.Messages, *moderationtest.Activities, *moderationtest.Queue, *comment.AdminService, comment.Comment) {
		repo := commenttest.NewMemoryRepository(func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) })
		parent := repo.Seed(comment.Comment{GameID: gameID, CreatorID: bob.UserID, Status: comment.StatusVisible})
		reply := repo.Seed(comment.Comment{GameID: gameID, CreatorID: alice.UserID, ParentID: &parent.ID, Status: comment.StatusPending})
		messages, activities, queue := &moderationtest.Messages{}, &moderationtest.Activities{}, &moderationtest.Queue{}
		service := comment.NewAdminService(repo, store, messages, activities, queue, &txtest.Immediate{})
		return repo, messages, activities, queue, service, reply
	}

	t.Run("approval records missing activity and reply notice", func(t *testing.T) {
		repo, messages, activities, _, service, reply := setup(&stubStore{})
		if err := service.SetStatus(ctx, admin, 999, comment.StatusChange{Status: comment.StatusVisible}); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("missing: %v", err)
		}
		if err := service.SetStatus(ctx, admin, reply.ID, comment.StatusChange{Status: comment.StatusVisible}); err != nil {
			t.Fatal(err)
		}
		if got, _ := repo.Get(ctx, reply.ID); got.Status != comment.StatusVisible {
			t.Fatalf("status not changed: %+v", got)
		}
		if len(activities.All()) != 1 || len(messages.All()) != 1 || messages.All()[0].ReceiverID != bob.UserID || messages.All()[0].Type != message.TypeCommentReply {
			t.Fatalf("unexpected side effects %+v %+v", activities.All(), messages.All())
		}
		if err := service.SetStatus(ctx, admin, reply.ID, comment.StatusChange{Status: comment.StatusVisible}); err != nil || len(messages.All()) != 1 {
			t.Fatalf("same status is a no-op: %v", err)
		}
	})

	t.Run("approval does not duplicate existing notices", func(t *testing.T) {
		_, messages, activities, _, service, reply := setup(&stubStore{activity: true, notice: true})
		if err := service.SetStatus(ctx, admin, reply.ID, comment.StatusChange{Status: comment.StatusVisible}); err != nil {
			t.Fatal(err)
		}
		if len(activities.All()) != 0 || len(messages.All()) != 0 {
			t.Fatal("existing activity and notice must not be duplicated")
		}
	})

	t.Run("blocking notifies unless suppressed", func(t *testing.T) {
		_, messages, _, _, service, reply := setup(&stubStore{})
		category := moderation.CategorySpam
		if err := service.SetStatus(ctx, admin, reply.ID, comment.StatusChange{Status: comment.StatusBlocked, TopCategory: &category, Reason: ptr("ads")}); err != nil {
			t.Fatal(err)
		}
		sent := messages.All()
		if len(sent) != 1 || sent[0].Content != "Messages.System.Moderation.Comment.Block.ReviewContent" || *sent[0].SenderID != admin.UserID || sent[0].ReceiverID != alice.UserID ||
			!maps.Equal(sent[0].Meta, message.Meta{"top_category": moderation.CategorySpam, "reason": "ads"}) {
			t.Fatalf("unexpected block notice %+v", sent)
		}
		_, quiet, _, _, service, reply := setup(&stubStore{})
		if err := service.SetStatus(ctx, admin, reply.ID, comment.StatusChange{Status: comment.StatusBlocked, Notify: ptr(false)}); err != nil || len(quiet.All()) != 0 {
			t.Fatalf("notify=false suppresses the notice: %v", err)
		}
		_, plain, _, _, service, reply := setup(&stubStore{})
		if err := service.SetStatus(ctx, admin, reply.ID, comment.StatusChange{Status: comment.StatusBlocked, Reason: ptr("")}); err != nil {
			t.Fatal(err)
		}
		if sent := plain.All(); sent[0].Content != "Messages.System.Moderation.Comment.Block.Content" || !maps.Equal(sent[0].Meta, message.Meta{"top_category": moderation.CategoryHarassment, "reason": ""}) {
			t.Fatalf("unexpected default block notice %+v %v", sent, sent[0].Meta)
		}
	})

	t.Run("rescan resets to pending and screens again", func(t *testing.T) {
		repo, _, _, queue, service, reply := setup(&stubStore{})
		_ = repo.SetStatus(ctx, reply.ID, comment.StatusBlocked)
		if err := service.Rescan(ctx, 999); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("missing: %v", err)
		}
		if err := service.Rescan(ctx, reply.ID); err != nil {
			t.Fatal(err)
		}
		if got, _ := repo.Get(ctx, reply.ID); got.Status != comment.StatusPending {
			t.Fatalf("rescan must reset the status: %+v", got)
		}
		if jobs := queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ScreenComment{CommentID: reply.ID}) {
			t.Fatalf("unexpected jobs %+v", jobs)
		}
	})
}

const (
	resourceID   = 31
	unpublished  = 32
	otherGameRes = 33
)

func resourceFixture() fixture {
	f := newFixture()
	f.resources[resourceID] = comment.ResourceRef{ID: resourceID, GameID: gameID, CreatorID: alice.UserID, FileNames: []string{"game.7z"}}
	f.resources[unpublished] = comment.ResourceRef{ID: unpublished, GameID: gameID, CreatorID: alice.UserID}
	f.resources[otherGameRes] = comment.ResourceRef{ID: otherGameRes, GameID: gameID, CreatorID: bob.UserID, FileNames: []string{"other.7z"}}
	return f
}

func TestCommentsOnAResourceStayWithIt(t *testing.T) {
	ctx := context.Background()
	f := resourceFixture()

	if _, err := f.service.CreateOnResource(ctx, bob, 404, comment.CreateInput{Content: document(t, "hi")}); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("an unknown resource: %v", err)
	}
	if _, err := f.service.CreateOnResource(ctx, bob, unpublished, comment.CreateInput{Content: document(t, "hi")}); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("a resource the viewer cannot open takes no comments: %v", err)
	}
	created, err := f.service.CreateOnResource(ctx, bob, resourceID, comment.CreateInput{Content: document(t, "在哪个目录？")})
	if err != nil {
		t.Fatal(err)
	}
	if created.GameID != gameID || created.ResourceID == nil || *created.ResourceID != resourceID || created.Status != comment.StatusPending {
		t.Fatalf("the comment belongs to the resource and its game: %+v", created.Comment)
	}
	if len(f.queue.Jobs) != 1 {
		t.Fatalf("resource comments are screened like any other: %+v", f.queue.Jobs)
	}
	onGame := f.repo.Seed(comment.Comment{GameID: gameID, CreatorID: bob.UserID, Status: comment.StatusVisible})
	elsewhere := f.repo.Seed(comment.Comment{GameID: gameID, ResourceID: ptr(otherGameRes), CreatorID: bob.UserID, Status: comment.StatusVisible})
	for name, parent := range map[string]int{"the game": onGame.ID, "another resource": elsewhere.ID} {
		if _, err := f.service.CreateOnResource(ctx, alice, resourceID, comment.CreateInput{Content: document(t, "re"), ParentID: &parent}); !errors.Is(err, comment.ErrNotFound) {
			t.Fatalf("a reply cannot answer a comment of %s: %v", name, err)
		}
	}
	if _, err := f.service.Create(ctx, alice, gameID, comment.CreateInput{Content: document(t, "re"), ParentID: &created.ID}); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("a comment on the game cannot answer a comment of a resource: %v", err)
	}
	reply, err := f.service.CreateOnResource(ctx, alice, resourceID, comment.CreateInput{Content: document(t, "在特典文件夹中"), ParentID: &created.ID})
	if err != nil || *reply.ResourceID != resourceID || *reply.RootID != created.ID {
		t.Fatalf("replies stay in the thread of the resource: %+v %v", reply.Comment, err)
	}

	list, err := f.service.ListByResource(ctx, bob, resourceID, comment.ThreadQuery{Order: comment.OrderNewest, Page: comment.Page{Number: 1, Size: 10}})
	if err != nil || list.Totals.Threads != 1 || list.Threads[0].ID != created.ID {
		t.Fatalf("the resource lists its own threads: %+v %v", list, err)
	}
	ofGame, _ := f.service.ListByGame(ctx, bob, comment.ThreadQuery{Subject: comment.Subject{GameID: gameID}, Order: comment.OrderNewest, Page: comment.Page{Number: 1, Size: 10}})
	if ofGame.Totals.Threads != 1 || ofGame.Threads[0].ID != onGame.ID {
		t.Fatalf("the game keeps only its own: %+v", ofGame)
	}
	if _, err := f.service.ListByResource(ctx, bob, unpublished, comment.ThreadQuery{Page: comment.Page{Number: 1, Size: 10}}); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("comments of a resource the viewer cannot open: %v", err)
	}
}
