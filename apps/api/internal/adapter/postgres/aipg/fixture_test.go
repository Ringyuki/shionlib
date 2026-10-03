package aipg_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/keybox"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai/aitest"
)

const keySecret = "aipg-test-secret-0123456789abcdef"

func newBox(t *testing.T) *keybox.Box {
	t.Helper()
	box, err := keybox.NewBox(keySecret)
	if err != nil {
		t.Fatal(err)
	}
	return box
}

func repositoryEnv(t *testing.T) (*pgtest.DB, aitest.RepositoryEnv) {
	t.Helper()
	db := pgtest.New(t)
	return db, aitest.RepositoryEnv{
		Repo: aipg.NewRepository(db.Ent, newBox(t)),
		SuperAdmin: func(t *testing.T) int {
			t.Helper()
			id := db.User(t)
			if err := db.Ent.User.UpdateOneID(id).SetRole(3).Exec(t.Context()); err != nil {
				t.Fatal(err)
			}
			db.User(t)
			return id
		},
		CatalogProvider: func(t *testing.T, id string) {
			t.Helper()
			if err := db.Ent.AICatalogProvider.Create().SetID(id).SetName(id).SetSyncedAt(time.Now().UTC()).Exec(t.Context()); err != nil {
				t.Fatal(err)
			}
		},
	}
}
