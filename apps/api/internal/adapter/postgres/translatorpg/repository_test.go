package translatorpg_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcetranslator"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/translatorpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator/translatortest"
)

func newEnv(t *testing.T) (translatortest.Env, *pgtest.DB) {
	db := pgtest.New(t)
	uploader := db.User(t)
	return translatortest.Env{
		Repo:  translatorpg.NewRepository(db.Ent),
		Store: translatorpg.NewAdminStore(db.Ent),
		Seed: func(t *testing.T, item translator.Translator) int {
			keys := make([]string, len(item.Aliases))
			for i, alias := range item.Aliases {
				keys[i] = translator.Key(alias)
			}
			row, err := db.Ent.Translator.Create().
				SetName(item.Name).
				SetNameKey(translator.Key(item.Name)).
				SetAliases(pgvalue.Strings(item.Aliases)).
				SetAliasKeys(pgvalue.Strings(keys)).
				SetNillableHomepage(item.Homepage).
				Save(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			return row.ID
		},
		NewGame: func(t *testing.T) int {
			return db.Game(t)
		},
		Credit: func(t *testing.T, gameID int, visible bool, at time.Time, translatorIDs ...int) int {
			create := db.Ent.GameDownloadResource.Create().
				SetGameID(gameID).
				SetCreatorID(uploader).
				SetPlatform(pgvalue.Strings{"win"}).
				SetLanguage(pgvalue.Strings{"zh"}).
				SetCreated(at)
			if visible {
				create.SetPublishedAt(at)
			}
			resource, err := create.Save(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			for position, id := range translatorIDs {
				if err := db.Ent.GameDownloadResourceTranslator.Create().SetResourceID(resource.ID).SetTranslatorID(id).SetPosition(position).Exec(t.Context()); err != nil {
					t.Fatal(err)
				}
			}
			return resource.ID
		},
		Credited: func(t *testing.T, resourceID int) []int {
			ids, err := db.Ent.GameDownloadResourceTranslator.Query().
				Where(gamedownloadresourcetranslator.ResourceID(resourceID)).
				Order(ent.Asc(gamedownloadresourcetranslator.FieldPosition)).
				Select(gamedownloadresourcetranslator.FieldTranslatorID).
				Ints(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			return ids
		},
	}, db
}

func TestRepositoryContract(t *testing.T) {
	translatortest.RepositoryContract(t, func(t *testing.T) translatortest.Env {
		env, _ := newEnv(t)
		return env
	})
}

func TestWorksLeaveOutHiddenGamesAndRemovedResources(t *testing.T) {
	env, db := newEnv(t)
	at := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	tea := env.Seed(t, translator.Translator{Name: "绿茶汉化组"})
	env.Credit(t, db.Game(t), true, at, tea)
	env.Credit(t, db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) }), true, at, tea)
	removed := env.Credit(t, db.Game(t), true, at, tea)
	if err := db.Ent.GameDownloadResource.UpdateOneID(removed).SetStatus(2).Exec(t.Context()); err != nil {
		t.Fatal(err)
	}
	if works, err := env.Repo.CountWorks(t.Context(), tea); err != nil || works != 1 {
		t.Fatalf("works %d %v", works, err)
	}
	items, total, err := env.Repo.List(t.Context(), "", translator.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || items[0].WorksCount != 1 {
		t.Fatalf("list %+v %d %v", items, total, err)
	}
}

func TestDeletingATranslatorDropsItsCredits(t *testing.T) {
	env, _ := newEnv(t)
	tea := env.Seed(t, translator.Translator{Name: "绿茶汉化组"})
	panda := env.Seed(t, translator.Translator{Name: "熊喵守护协会"})
	resource := env.Credit(t, env.NewGame(t), true, time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC), tea, panda)
	if err := env.Repo.Delete(t.Context(), tea); err != nil {
		t.Fatal(err)
	}
	if got := env.Credited(t, resource); len(got) != 1 || got[0] != panda {
		t.Fatalf("credits %v", got)
	}
}
