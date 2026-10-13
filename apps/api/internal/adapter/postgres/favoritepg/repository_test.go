package favoritepg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/favoritepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite/favoritetest"
)

func TestRepositoryContract(t *testing.T) {
	favoritetest.RepositoryContract(t, func(t *testing.T) favoritetest.Env {
		db := pgtest.New(t)
		return favoritetest.Env{
			Repo:    favoritepg.NewRepository(db.Ent),
			NewUser: db.User,
			NewGame: func(t *testing.T) int { return db.Game(t) },
		}
	})
}
