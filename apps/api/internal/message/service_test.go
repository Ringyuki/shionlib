package message_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/message/messagetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	receiver = actor.Actor{UserID: 7, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	stranger = actor.Actor{UserID: 8, Role: actor.RoleUser}
	now      = time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
)

type fixture struct {
	repo     *messagetest.MemoryRepository
	notifier *messagetest.RecordingNotifier
	tx       *txtest.Immediate
	service  *message.Service
}

func newFixture() fixture {
	repo := messagetest.NewMemoryRepository(func() time.Time { return now })
	notifier := &messagetest.RecordingNotifier{}
	tx := &txtest.Immediate{}
	cards := gametest.NewCards(game.Card{ID: 3, Covers: []game.Cover{{URL: "safe"}, {URL: "rated", Sexual: 1}}})
	return fixture{repo: repo, notifier: notifier, tx: tx, service: message.NewService(repo, notifier, cards, tx, func() time.Time { return now })}
}

func ptr[T any](v T) *T {
	return &v
}

func TestSendSkipsSelfNotificationsForCommentEvents(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	for _, kind := range []message.Type{message.TypeCommentLike, message.TypeCommentReply} {
		if err := f.service.Send(ctx, message.NewMessage{Type: kind, Title: "t", Content: "c", SenderID: ptr(7), ReceiverID: 7}); err != nil {
			t.Fatal(err)
		}
	}
	if count, _ := f.repo.CountUnread(ctx, 7); count != 0 || len(f.notifier.Notices) != 0 {
		t.Fatalf("self notifications must be skipped: count=%d notices=%v", count, f.notifier.Notices)
	}
	if err := f.service.Send(ctx, message.NewMessage{Type: message.TypeSystem, Title: "t", Content: "c", SenderID: ptr(7), ReceiverID: 7}); err != nil {
		t.Fatal(err)
	}
	if len(f.notifier.Notices) != 1 || f.notifier.Notices[0].Notice.Tone != message.ToneInfo {
		t.Fatalf("system messages to oneself are delivered with the default tone: %+v", f.notifier.Notices)
	}
}

func TestSendNotifiesOnlyAfterCommit(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	boom := errors.New("rollback")
	err := f.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := f.service.Send(ctx, message.NewMessage{Type: message.TypeSystem, Title: "t", Content: "c", ReceiverID: 7}); err != nil {
			return err
		}
		if len(f.notifier.Notices) != 0 {
			t.Fatal("notification fired before commit")
		}
		return boom
	})
	if !errors.Is(err, boom) || len(f.notifier.Notices) != 0 {
		t.Fatalf("rolled back sends must not notify: %v %v", err, f.notifier.Notices)
	}
	err = f.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		return f.service.Send(ctx, message.NewMessage{Type: message.TypeSystem, Title: "t", Content: "c", ReceiverID: 7})
	})
	if err != nil || len(f.notifier.Notices) != 1 || f.notifier.Notices[0].UserID != 7 {
		t.Fatalf("committed send must notify once: %v %+v", err, f.notifier.Notices)
	}
}

func TestOpenMarksReadAndHydratesGame(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if err := f.service.Send(ctx, message.NewMessage{Type: message.TypeSystem, Title: "t", Content: "c", GameID: ptr(3), ReceiverID: 7}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Open(ctx, receiver, 999); !errors.Is(err, message.ErrNotFound) {
		t.Fatalf("missing message: %v", err)
	}
	if _, err := f.service.Open(ctx, stranger, 1); !errors.Is(err, message.ErrForbidden) {
		t.Fatalf("foreign message: %v", err)
	}
	detail, err := f.service.Open(ctx, receiver, 1)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Read || detail.ReadAt != nil {
		t.Fatalf("the opened message reports its state before opening: %+v", detail)
	}
	if detail.Game == nil || len(detail.Game.Covers) != 1 {
		t.Fatalf("game card must be hydrated and filtered for the viewer: %+v", detail.Game)
	}
	if count, _ := f.repo.CountUnread(ctx, 7); count != 0 {
		t.Fatalf("message was not marked read")
	}
	last := f.notifier.Unreads[len(f.notifier.Unreads)-1]
	if last.UserID != 7 || last.Count != 0 {
		t.Fatalf("unread count must be pushed after opening: %+v", f.notifier.Unreads)
	}
}

func TestReadStateEndpoints(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	for range 2 {
		if err := f.service.Send(ctx, message.NewMessage{Type: message.TypeSystem, Title: "t", Content: "c", ReceiverID: 7}); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.service.MarkRead(ctx, stranger, 1); !errors.Is(err, message.ErrNotFound) {
		t.Fatalf("marking someone else's message must not leak: %v", err)
	}
	if err := f.service.MarkRead(ctx, receiver, 1); err != nil {
		t.Fatal(err)
	}
	if got := f.notifier.Unreads[len(f.notifier.Unreads)-1]; got.Count != 1 {
		t.Fatalf("unread after one read: %+v", got)
	}
	if err := f.service.MarkAllRead(ctx, receiver); err != nil {
		t.Fatal(err)
	}
	if got := f.notifier.Unreads[len(f.notifier.Unreads)-1]; got.Count != 0 {
		t.Fatalf("unread after all read: %+v", got)
	}
	if err := f.service.MarkAllUnread(ctx, receiver); err != nil {
		t.Fatal(err)
	}
	if got := f.notifier.Unreads[len(f.notifier.Unreads)-1]; got.Count != 2 {
		t.Fatalf("unread after all unread: %+v", got)
	}
	if count, _ := f.service.UnreadCount(ctx, receiver); count != 2 {
		t.Fatalf("unread count %d", count)
	}
	items, total, err := f.service.List(ctx, receiver, message.Filter{Unread: ptr(true)}, message.Page{Number: 1, Size: 1})
	if err != nil || total != 2 || len(items) != 1 {
		t.Fatalf("list: %+v %d %v", items, total, err)
	}
}
