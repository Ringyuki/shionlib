package apikey

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

type Repository interface {
	Create(ctx context.Context, in NewKey) (Key, error)
	Mine(ctx context.Context, userID int) ([]Key, error)
	CountMine(ctx context.Context, userID int) (int, error)
	DeleteMine(ctx context.Context, userID, id int) error
	BySecretHash(ctx context.Context, hash string) (Key, error)
	Owner(ctx context.Context, userID int) (Owner, error)
	Touch(ctx context.Context, id int, at time.Time, ip string) error
	Get(ctx context.Context, id int) (Key, error)
	SetSuspended(ctx context.Context, id int, reason *string, at *time.Time, by *int) error
	SetAccountLimit(ctx context.Context, userID int, limit *int) error
}

type UsageStore interface {
	SaveCounts(ctx context.Context, counts []Count) error
	PruneBefore(ctx context.Context, day time.Time) error
	Summary(ctx context.Context, today, since time.Time) (Summary, error)
	Days(ctx context.Context, since time.Time, keyID *int) ([]Day, error)
	List(ctx context.Context, filter Filter, page paging.Page) ([]Listed, int, error)
	Detail(ctx context.Context, id int, since time.Time) (Detail, error)
}

type Counter interface {
	Count(ctx context.Context, keyID int, day time.Time, throttled bool) error
	Counts(ctx context.Context, day time.Time) ([]Count, error)
}

type Messenger interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
