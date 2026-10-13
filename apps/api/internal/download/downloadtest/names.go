package downloadtest

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

type Media struct {
	Formats map[int]string
}

func (m Media) Medium(_ context.Context, inspectionID int) (string, error) {
	return m.Formats[inspectionID], nil
}

func Names(repo *MemoryRepository, games download.GameCards, media Media) *download.NameService {
	return download.NewNameService(repo, games, media, &txtest.Immediate{})
}
