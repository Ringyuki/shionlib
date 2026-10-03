package catalogpg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/catalogpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
)

func TestStoreContract(t *testing.T) {
	catalogtest.StoreContract(t, func(t *testing.T) catalogtest.Env {
		db := pgtest.New(t)
		return catalogtest.Env{Store: catalogpg.NewStore(db.Ent), CreatorID: db.User}
	})
}
