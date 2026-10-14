package open

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type Games interface {
	Find(ctx context.Context, kind Kind, values []string) ([]Game, error)
}

type Resources interface {
	PublicResources(ctx context.Context, gameIDs []int) (map[int][]download.GameResource, error)
}
