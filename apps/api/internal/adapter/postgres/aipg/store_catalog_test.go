package aipg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai/aitest"
)

func TestCatalogStoreContract(t *testing.T) {
	aitest.CatalogStoreContract(t, func(t *testing.T) ai.CatalogStore {
		return aipg.NewCatalogStore(pgtest.New(t).Ent)
	})
}
