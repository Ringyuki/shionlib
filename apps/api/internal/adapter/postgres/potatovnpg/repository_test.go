package potatovnpg_test

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/potatovnpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn/potatovntest"
)

var tagSequence atomic.Int64

func TestRepositoryContract(t *testing.T) {
	potatovntest.RepositoryContract(t, func(t *testing.T) potatovntest.Env {
		db := pgtest.New(t)
		repo := potatovnpg.NewRepository(db.Ent)
		return potatovntest.Env{
			Repo:    repo,
			Catalog: repo,
			NewUser: db.User,
			NewGame: func(t *testing.T, fixture potatovntest.GameFixture) int {
				ctx := context.Background()
				gameID := db.Game(t, func(c *ent.GameCreate) {
					c.SetNillableVID(fixture.VNDBID).
						SetNillableBID(fixture.BangumiID).
						SetTitleJp(fixture.TitleJP).
						SetTitleZh(fixture.TitleZH).
						SetIntroZh(fixture.IntroZH).
						SetNillableReleaseDate(fixture.ReleaseDate)
				})
				for _, tag := range fixture.Tags {
					row, err := db.Ent.Tag.Create().SetName(fmt.Sprintf("%s-%d", tag.Name, tagSequence.Add(1))).Save(ctx)
					if err != nil {
						t.Fatal(err)
					}
					alias := tag.Alias
					if alias == nil {
						if err := db.Ent.Tag.UpdateOneID(row.ID).SetName(tag.Name).Exec(ctx); err != nil {
							t.Fatal(err)
						}
					}
					if err := db.Ent.GameTagRelation.Create().SetGameID(gameID).SetTagID(row.ID).SetNillableTagAlias(alias).Exec(ctx); err != nil {
						t.Fatal(err)
					}
				}
				for _, cover := range fixture.Covers {
					if err := db.Ent.GameCover.Create().
						SetGameID(gameID).
						SetLanguage("jp").
						SetType("pkgfront").
						SetURL(cover.URL).
						SetDims(pgvalue.Ints{1, 1}).
						SetSexual(cover.Sexual).
						SetViolence(cover.Violence).
						Exec(ctx); err != nil {
						t.Fatal(err)
					}
				}
				return gameID
			},
		}
	})
}
