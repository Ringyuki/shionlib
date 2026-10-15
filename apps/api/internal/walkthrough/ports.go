package walkthrough

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Repository interface {
	Get(ctx context.Context, id int) (Walkthrough, error)
	Lock(ctx context.Context, id int) (Walkthrough, error)
	LockWritten(ctx context.Context, gameID, creatorID int) (Walkthrough, error)
	View(ctx context.Context, id int) (View, error)
	Create(ctx context.Context, in NewWalkthrough) (Walkthrough, error)
	Update(ctx context.Context, id int, changes Changes) error
	SetStatus(ctx context.Context, id int, status Status) error
	MarkReviewPending(ctx context.Context, id int) error
	Written(ctx context.Context, gameID, creatorID int) (Summary, error)
	ListPublished(ctx context.Context, gameID, limit int) ([]Summary, error)
	ListByCreator(ctx context.Context, filter CreatorFilter, page Page) ([]Summary, int, error)
}

type AdminStore interface {
	Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error)
	Detail(ctx context.Context, id int) (AdminDetail, error)
}

type GameCards interface {
	Exists(ctx context.Context, id int) (bool, error)
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Activities interface {
	Record(ctx context.Context, in activity.NewActivity) error
}

type Job = interface{ Kind() string }

type Queue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type Cast interface {
	Cast(ctx context.Context, gameID int) ([]CastMember, error)
}

type Formatter interface {
	Ready(ctx context.Context) (bool, error)
	Format(ctx context.Context, request FormatRequest) (Formatted, error)
}

type FormatTasks interface {
	Save(ctx context.Context, task FormatTask, ttl time.Duration) error
	Get(ctx context.Context, id string) (FormatTask, bool, error)
}

type FormatQuota interface {
	Take(ctx context.Context, userID int, day string, limit int) (bool, error)
}
