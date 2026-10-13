package activity

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Repository interface {
	Create(ctx context.Context, in NewActivity) error
	List(ctx context.Context, filter Filter, page Page) ([]Entry, int, error)
}

type GameCards interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}
