package gamepg

import (
	"context"
	"fmt"

	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

func (r *Repository) Referenced(ctx context.Context, reference game.Reference) ([]int, error) {
	ids, err := r.db(ctx).Game.Query().Where(referencePredicate(reference)).Order(entgame.ByID()).IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("find games by %s id %s: %w", reference.Source, reference.Key(), err)
	}
	return ids, nil
}

func referencePredicate(reference game.Reference) predicate.Game {
	switch reference.Source {
	case game.ReferenceVNDB:
		return entgame.VID(reference.Key())
	case game.ReferenceBangumi:
		return entgame.BID(reference.Key())
	default:
		return entgame.HID(reference.Number)
	}
}
