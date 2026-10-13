package adpg_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/adpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
)

func TestRepositoryContract(t *testing.T) {
	adtest.RepositoryContract(t, func(t *testing.T) adtest.Env {
		db := pgtest.New(t)
		repo := adpg.NewRepository(db.Ent)
		return adtest.Env{
			Repo:     repo,
			Sponsors: repo,
			NewUser:  db.User,
			SetSponsor: func(t *testing.T, id int, until time.Time) {
				if err := db.Ent.User.UpdateOneID(id).SetSponsorExpiresAt(until).Exec(context.Background()); err != nil {
					t.Fatal(err)
				}
			},
		}
	})
}
