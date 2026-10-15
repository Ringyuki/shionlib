package walkthroughpg_test

import (
	"context"
	"reflect"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/walkthroughpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

func TestCastListsEveryNameOfTheGamesCharacters(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	gameID := db.Game(t)
	other := db.Game(t)
	touka := db.Ent.GameCharacter.Create().SetNameJp("新谷 灯華").SetNameZh("新谷 灯华").SetNameEn("Touka Niiya").SetAliases([]string{"灯華", " ", "新谷 灯华"}).SaveX(ctx)
	uguisu := db.Ent.GameCharacter.Create().SetNameJp("日紫喜 うぐいす").SaveX(ctx)
	stranger := db.Ent.GameCharacter.Create().SetNameJp("他人").SaveX(ctx)
	db.Ent.GameCharacterRelation.Create().SetGameID(gameID).SetCharacterID(touka.ID).SetRole(gamecharacterrelation.RoleMain).ExecX(ctx)
	db.Ent.GameCharacterRelation.Create().SetGameID(gameID).SetCharacterID(uguisu.ID).ExecX(ctx)
	db.Ent.GameCharacterRelation.Create().SetGameID(other).SetCharacterID(stranger.ID).ExecX(ctx)

	cast, err := walkthroughpg.NewCastStore(db.Ent).Cast(ctx, gameID)
	if err != nil {
		t.Fatal(err)
	}
	want := []walkthrough.CastMember{
		{ID: touka.ID, Names: []string{"新谷 灯華", "新谷 灯华", "Touka Niiya", "灯華"}},
		{ID: uguisu.ID, Names: []string{"日紫喜 うぐいす"}},
	}
	if !reflect.DeepEqual(cast, want) {
		t.Fatalf("cast\n got %+v\nwant %+v", cast, want)
	}
}
