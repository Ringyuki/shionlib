package settingpg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/settingpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestRepositoryContract(t *testing.T) {
	settingtest.RepositoryContract(t, func(t *testing.T) settingtest.Env {
		db := pgtest.New(t)
		return settingtest.Env{
			Repo: settingpg.NewRepository(db.Ent),
			NewEditor: func(t *testing.T) setting.Editor {
				id := db.User(t)
				user, err := db.Ent.User.Get(context.Background(), id)
				if err != nil {
					t.Fatal(err)
				}
				return setting.Editor{ID: id, Name: user.Name}
			},
		}
	})
}
