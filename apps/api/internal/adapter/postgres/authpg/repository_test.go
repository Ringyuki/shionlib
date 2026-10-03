package authpg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/authpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
)

func TestRepositoryContract(t *testing.T) {
	authtest.RepositoryContract(t, func(t *testing.T) authtest.Env {
		db := pgtest.New(t)
		return authtest.Env{Repo: authpg.NewRepository(db.Ent), NewUser: db.User}
	})
}
