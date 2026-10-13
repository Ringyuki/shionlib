package sponsorpg_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sponsorpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor/sponsortest"
)

func TestRepositoryContract(t *testing.T) {
	sponsortest.RepositoryContract(t, func(t *testing.T) sponsortest.Env {
		db := pgtest.New(t)
		return sponsortest.Env{
			Repo:    sponsorpg.NewRepository(db.Ent),
			NewUser: db.User,
			Describe: func(t *testing.T, id int, cover, bio string) {
				if err := db.Ent.User.UpdateOneID(id).SetCover(cover).SetBio(bio).Exec(context.Background()); err != nil {
					t.Fatal(err)
				}
			},
			SponsorUntil: func(t *testing.T, id int) *time.Time {
				row, err := db.Ent.User.Get(context.Background(), id)
				if err != nil {
					t.Fatal(err)
				}
				return row.SponsorExpiresAt
			},
		}
	})
}
