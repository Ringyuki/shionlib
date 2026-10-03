package message

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Repository interface {
	Create(ctx context.Context, in NewMessage) (Message, error)
	Get(ctx context.Context, id int) (Stored, error)
	List(ctx context.Context, receiverID int, filter Filter, page Page) ([]Message, int, error)
	CountUnread(ctx context.Context, receiverID int) (int, error)
	MarkRead(ctx context.Context, id, receiverID int, at time.Time) error
	MarkAllRead(ctx context.Context, receiverID int, at time.Time) error
	MarkAllUnread(ctx context.Context, receiverID int) error
}

type Notifier interface {
	NewMessage(ctx context.Context, receiverID int, notice Notice)
	Unread(ctx context.Context, receiverID int, count int)
}

type GameCards interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
