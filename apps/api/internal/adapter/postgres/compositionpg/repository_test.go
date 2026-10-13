package compositionpg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/compositionpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
)

func TestRepositoryContract(t *testing.T) {
	compositiontest.RepositoryContract(t, func(t *testing.T) compositiontest.Env {
		db := pgtest.New(t)
		return compositiontest.Env{
			Repo: compositionpg.NewRepository(db.Ent),
			NewResource: func(t *testing.T) int {
				return db.Ent.GameDownloadResource.Create().SetGameID(db.Game(t)).SetCreatorID(db.User(t)).SaveX(context.Background()).ID
			},
		}
	})
}

func TestCompositionsGoWithTheirResource(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := compositionpg.NewRepository(db.Ent)
	resource := db.Ent.GameDownloadResource.Create().SetGameID(db.Game(t)).SetCreatorID(db.User(t)).SaveX(ctx).ID
	created, err := repo.Create(ctx, compositiontest.Seed(resource))
	if err != nil {
		t.Fatal(err)
	}
	db.Ent.GameDownloadResource.DeleteOneID(resource).ExecX(ctx)
	if existing, err := repo.Existing(ctx, []int{created.ID}); err != nil || len(existing) != 0 {
		t.Fatalf("deleting a resource deletes its compositions: %v %v", existing, err)
	}
}
