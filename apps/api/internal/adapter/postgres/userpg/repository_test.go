package userpg_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/editrecord"
	entfavorite "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/useruploadquota"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

func TestRepositoryContract(t *testing.T) {
	usertest.RepositoryContract(t, func(t *testing.T) usertest.Env {
		db := pgtest.New(t)
		return usertest.Env{
			Repo: userpg.NewRepository(db.Ent),
			HasDefaultFavorite: func(t *testing.T, id int) bool {
				ok, err := db.Ent.Favorite.Query().Where(entfavorite.UserID(id), entfavorite.Default(true), entfavorite.Name("default")).Exist(context.Background())
				if err != nil {
					t.Fatal(err)
				}
				return ok
			},
			HasQuota: func(t *testing.T, id int) bool {
				quota, err := db.Ent.UserUploadQuota.Query().Where(useruploadquota.UserID(id)).Only(context.Background())
				if err != nil {
					t.Fatal(err)
				}
				return quota.Size == 0 && quota.Used == 0
			},
		}
	})
}

func TestStatsCountsEveryContribution(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := userpg.NewRepository(db.Ent)
	owner := db.User(t)
	game := db.Game(t)
	fav, err := db.Ent.Favorite.Create().SetUserID(owner).SetName("list").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ent.FavoriteItem.Create().SetFavoriteID(fav.ID).SetGameID(game).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := db.Ent.EditRecord.Create().SetEntity(editrecord.EntityGame).SetTargetID(game).SetAction(editrecord.ActionUPDATE_SCALAR).SetActorID(owner).SetActorRole(1).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	stats, err := repo.Stats(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	if stats != (user.Stats{FavoriteItems: 1, Edits: 1}) {
		t.Fatalf("unexpected stats %+v", stats)
	}
}

func TestEditRecordsHideRatedGamesFromStrictViewers(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := userpg.NewEditRecordStore(db.Ent)
	editor := db.User(t)
	safe := db.Game(t, func(c *ent.GameCreate) { c.SetTitleZh("安全") })
	rated := db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	ratedCover := db.Game(t)
	if err := db.Ent.GameCover.Create().SetGameID(ratedCover).SetLanguage("jp").SetURL("c.webp").SetType("pkgfront").SetSexual(2).SetViolence(0).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := db.Ent.GameCover.Create().SetGameID(safe).SetLanguage("jp").SetURL("s.webp").SetType("pkgfront").SetSexual(0).SetViolence(1).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	character, err := db.Ent.GameCharacter.Create().SetNameJp("キャラ").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, target := range []int{safe, rated, ratedCover} {
		if err := db.Ent.EditRecord.Create().SetEntity(editrecord.EntityGame).SetTargetID(target).SetAction(editrecord.ActionUPDATE_SCALAR).SetActorID(editor).SetActorRole(1).SetChanges(json.RawMessage(`{"title_zh":"x"}`)).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Ent.EditRecord.Create().SetEntity(editrecord.EntityCharacter).SetTargetID(character.ID).SetAction(editrecord.ActionADD_RELATION).SetActorID(editor).SetActorRole(1).SetRelationType(editrecord.RelationTypeCharacter).Exec(ctx); err != nil {
		t.Fatal(err)
	}

	strict, total, err := store.ListByActor(ctx, editor, actor.Actor{UserID: 99, ContentLimit: actor.ContentLimitNeverShow}, user.Page{Number: 1, Size: 10})
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 || len(strict) != 2 {
		t.Fatalf("strict viewers only see safe targets: total=%d %+v", total, strict)
	}
	if strict[0].Entity != user.EditedCharacterEntity || strict[0].Character == nil || strict[0].Character.NameJP != "キャラ" || strict[0].RelationType == nil || *strict[0].RelationType != "character" {
		t.Fatalf("newest record first with character info: %+v", strict[0])
	}
	if strict[1].Game == nil || strict[1].Game.TitleZH != "安全" || len(strict[1].Game.Covers) != 1 || string(strict[1].Changes) != `{"title_zh": "x"}` && string(strict[1].Changes) != `{"title_zh":"x"}` {
		t.Fatalf("game info: %+v %s", strict[1].Game, strict[1].Changes)
	}
	permissive, total, err := store.ListByActor(ctx, editor, actor.Actor{UserID: 99, ContentLimit: actor.ContentLimitJustShow}, user.Page{Number: 1, Size: 2})
	if err != nil || total != 4 || len(permissive) != 2 {
		t.Fatalf("permissive viewers see everything: %d %d %v", total, len(permissive), err)
	}
}
