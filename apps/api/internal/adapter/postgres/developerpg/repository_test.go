package developerpg_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/developerpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer/developertest"
)

func TestRepositoryContract(t *testing.T) {
	developertest.RepositoryContract(t, func(t *testing.T) developertest.Env {
		db := pgtest.New(t)
		ctx := context.Background()
		return developertest.Env{
			Repo: developerpg.NewRepository(db.Ent),
			Seed: func(t *testing.T, d developer.Developer) int {
				create := db.Ent.GameDeveloper.Create().
					SetName(d.Name).
					SetAliases(pgvalue.Strings(d.Aliases)).
					SetNillableLogo(d.Logo).
					SetIntroJp(d.IntroJP).
					SetIntroZh(d.IntroZH).
					SetIntroEn(d.IntroEN).
					SetNillableWebsite(d.Website).
					SetNillableHID(d.HID).
					SetNillableParentDeveloperID(d.ParentID)
				if d.ExtraInfo != nil {
					entries := make([]map[string]string, len(d.ExtraInfo))
					for i, entry := range d.ExtraInfo {
						entries[i] = map[string]string{"key": entry.Key, "value": entry.Value}
					}
					raw, _ := json.Marshal(entries)
					create.SetExtraInfo(raw)
				}
				row, err := create.Save(ctx)
				if err != nil {
					t.Fatal(err)
				}
				return row.ID
			},
			Link: func(t *testing.T, developerID int, hidden bool) {
				status := 1
				if hidden {
					status = 2
				}
				gameID := db.Game(t, func(c *ent.GameCreate) { c.SetStatus(status) })
				if err := db.Ent.GameDeveloperRelation.Create().SetGameID(gameID).SetDeveloperID(developerID).Exec(t.Context()); err != nil {
					t.Fatal(err)
				}
			},
		}
	})
}
