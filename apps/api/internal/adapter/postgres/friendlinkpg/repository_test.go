package friendlinkpg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/friendlinkpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink/friendlinktest"
)

func TestRepositoryContract(t *testing.T) {
	friendlinktest.RepositoryContract(t, func(t *testing.T) friendlinktest.Env {
		return friendlinktest.Env{Repo: friendlinkpg.NewRepository(pgtest.New(t).Ent)}
	})
}
