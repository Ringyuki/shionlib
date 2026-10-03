package messagetest

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Env struct {
	Repo    message.Repository
	NewUser func(t *testing.T) int
	NewGame func(t *testing.T) int
}

func ptr[T any](v T) *T {
	return &v
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	at := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)

	t.Run("create stores every field and resolves participants", func(t *testing.T) {
		env := newEnv(t)
		sender, receiver := env.NewUser(t), env.NewUser(t)
		gameID := env.NewGame(t)
		created, err := env.Repo.Create(ctx, message.NewMessage{
			Type: message.TypeSystem, Tone: message.ToneWarning, Title: "Messages.Title", Content: "body",
			LinkText: ptr("open"), LinkURL: ptr("/x"), ExternalLink: true, Meta: message.Meta{"file_id": 7},
			GameID: &gameID, SenderID: &sender, ReceiverID: receiver,
		})
		if err != nil {
			t.Fatal(err)
		}
		stored, err := env.Repo.Get(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if stored.Type != message.TypeSystem || stored.Tone != message.ToneWarning || stored.Title != "Messages.Title" || stored.Content != "body" ||
			stored.LinkText == nil || *stored.LinkText != "open" || stored.LinkURL == nil || *stored.LinkURL != "/x" || !stored.ExternalLink ||
			stored.GameID == nil || *stored.GameID != gameID || stored.Sender == nil || stored.Sender.ID != sender || stored.Receiver.ID != receiver ||
			stored.Read || stored.ReadAt != nil {
			t.Fatalf("unexpected stored message %+v", stored)
		}
		var meta map[string]int
		if err := json.Unmarshal(stored.Meta, &meta); err != nil || meta["file_id"] != 7 {
			t.Fatalf("meta round trip: %s %v", stored.Meta, err)
		}
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, message.ErrNotFound) {
			t.Fatalf("missing message: %v", err)
		}
	})

	t.Run("list filters by receiver, read state and type newest first", func(t *testing.T) {
		env := newEnv(t)
		receiver, other := env.NewUser(t), env.NewUser(t)
		var ids []int
		for _, kind := range []message.Type{message.TypeSystem, message.TypeCommentLike, message.TypeSystem} {
			created, err := env.Repo.Create(ctx, message.NewMessage{Type: kind, Tone: message.ToneInfo, Title: "t", Content: "c", ReceiverID: receiver})
			if err != nil {
				t.Fatal(err)
			}
			ids = append(ids, created.ID)
		}
		if _, err := env.Repo.Create(ctx, message.NewMessage{Type: message.TypeSystem, Tone: message.ToneInfo, Title: "t", Content: "c", ReceiverID: other}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.MarkRead(ctx, ids[0], receiver, at); err != nil {
			t.Fatal(err)
		}
		all, total, err := env.Repo.List(ctx, receiver, message.Filter{}, message.Page{Number: 1, Size: 10})
		if err != nil || total != 3 || all[0].ID != ids[2] || all[2].ID != ids[0] {
			t.Fatalf("list all: %+v total=%d err=%v", all, total, err)
		}
		unread, total, _ := env.Repo.List(ctx, receiver, message.Filter{Unread: ptr(true), Type: ptr(message.TypeSystem)}, message.Page{Number: 1, Size: 10})
		if total != 1 || unread[0].ID != ids[2] {
			t.Fatalf("unread system: %+v total=%d", unread, total)
		}
		read, total, _ := env.Repo.List(ctx, receiver, message.Filter{Unread: ptr(false)}, message.Page{Number: 1, Size: 10})
		if total != 1 || read[0].ID != ids[0] || !read[0].Read || read[0].ReadAt == nil {
			t.Fatalf("read only: %+v total=%d", read, total)
		}
		paged, total, _ := env.Repo.List(ctx, receiver, message.Filter{}, message.Page{Number: 2, Size: 2})
		if total != 3 || len(paged) != 1 || paged[0].ID != ids[0] {
			t.Fatalf("second page: %+v total=%d", paged, total)
		}
	})

	t.Run("read state transitions and unread counts", func(t *testing.T) {
		env := newEnv(t)
		receiver, other := env.NewUser(t), env.NewUser(t)
		first, _ := env.Repo.Create(ctx, message.NewMessage{Type: message.TypeSystem, Tone: message.ToneInfo, Title: "a", Content: "a", ReceiverID: receiver})
		if _, err := env.Repo.Create(ctx, message.NewMessage{Type: message.TypeSystem, Tone: message.ToneInfo, Title: "b", Content: "b", ReceiverID: receiver}); err != nil {
			t.Fatal(err)
		}
		if count, _ := env.Repo.CountUnread(ctx, receiver); count != 2 {
			t.Fatalf("initial unread %d", count)
		}
		if err := env.Repo.MarkRead(ctx, first.ID, other, at); !errors.Is(err, message.ErrNotFound) {
			t.Fatalf("marking someone else's message: %v", err)
		}
		if err := env.Repo.MarkRead(ctx, first.ID, receiver, at); err != nil {
			t.Fatal(err)
		}
		if count, _ := env.Repo.CountUnread(ctx, receiver); count != 1 {
			t.Fatalf("after mark read %d", count)
		}
		if err := env.Repo.MarkAllRead(ctx, receiver, at); err != nil {
			t.Fatal(err)
		}
		if count, _ := env.Repo.CountUnread(ctx, receiver); count != 0 {
			t.Fatalf("after mark all read %d", count)
		}
		if err := env.Repo.MarkAllUnread(ctx, receiver); err != nil {
			t.Fatal(err)
		}
		stored, _ := env.Repo.Get(ctx, first.ID)
		if count, _ := env.Repo.CountUnread(ctx, receiver); count != 2 || stored.Read || stored.ReadAt != nil {
			t.Fatalf("after mark all unread %d %+v", count, stored)
		}
	})
}
