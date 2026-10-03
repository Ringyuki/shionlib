package characterpg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/characterpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/character/charactertest"
)

func TestRepositoryContract(t *testing.T) {
	charactertest.RepositoryContract(t, func(t *testing.T) charactertest.Env {
		db := pgtest.New(t)
		ctx := context.Background()
		return charactertest.Env{
			Repo: characterpg.NewRepository(db.Ent),
			Seed: func(t *testing.T, c character.Character) int {
				create := db.Ent.GameCharacter.Create().
					SetNameJp(c.NameJP).
					SetNillableNameZh(c.NameZH).
					SetNillableNameEn(c.NameEN).
					SetAliases(pgvalue.Strings(c.Aliases)).
					SetIntroJp(c.IntroJP).
					SetNillableImage(c.Image).
					SetNillableHID(c.HID).
					SetNillableHeight(c.Height).
					SetNillableCup(c.Cup).
					SetNillableAge(c.Age).
					SetBirthday(pgvalue.Ints(c.Birthday)).
					SetGender(pgvalue.Strings(c.Gender))
				if c.BloodType != nil {
					create.SetBloodType(gamecharacter.BloodType(*c.BloodType))
				}
				row, err := create.Save(ctx)
				if err != nil {
					t.Fatal(err)
				}
				return row.ID
			},
			Link: func(t *testing.T, characterID int) {
				if err := db.Ent.GameCharacterRelation.Create().SetGameID(db.Game(t)).SetCharacterID(characterID).Exec(t.Context()); err != nil {
					t.Fatal(err)
				}
			},
		}
	})
}
