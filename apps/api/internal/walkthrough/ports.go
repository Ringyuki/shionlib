package walkthrough

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Repository interface {
	Get(ctx context.Context, id int) (Walkthrough, error)
	Lock(ctx context.Context, id int) (Walkthrough, error)
	View(ctx context.Context, id int) (View, error)
	Create(ctx context.Context, in NewWalkthrough) (Walkthrough, error)
	Update(ctx context.Context, id int, changes Changes) error
	SetStatus(ctx context.Context, id int, status Status) error
	MarkReviewPending(ctx context.Context, id int) error
	ListByGame(ctx context.Context, filter GameFilter, page Page) ([]Summary, int, error)
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
