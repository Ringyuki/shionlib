package apikeypg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/apikeypg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey/apikeytest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func TestRepositoryContract(t *testing.T) {
	apikeytest.RepositoryContract(t, func(t *testing.T) apikeytest.Env {
		db := pgtest.New(t)
		return apikeytest.Env{
			Repo: apikeypg.NewRepository(db.Ent),
			NewUser: func(t *testing.T, banned bool) int {
				id := db.User(t)
				if banned {
					if err := db.Ent.User.UpdateOneID(id).SetStatus(int(user.StatusBanned)).Exec(t.Context()); err != nil {
						t.Fatal(err)
					}
				}
				return id
			},
		}
	})
}
