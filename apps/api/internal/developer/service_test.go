package developer_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer/developertest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func TestDeleteBlockers(t *testing.T) {
	ctx := context.Background()
	repo := developertest.NewMemoryRepository()
	tx := &txtest.Immediate{}
	service := developer.NewService(repo, tx)
	linked := repo.Seed(developer.Developer{Name: "linked"})
	repo.Link(linked.ID, true)
	parent := repo.Seed(developer.Developer{Name: "parent"})
	repo.Seed(developer.Developer{Name: "child", ParentID: &parent.ID})
	free := repo.Seed(developer.Developer{Name: "free"})

	cases := []struct {
		name string
		id   int
		want error
	}{
		{name: "missing", id: 999, want: developer.ErrNotFound},
		{name: "relations, even to hidden games", id: linked.ID, want: developer.ErrHasRelations},
		{name: "children", id: parent.ID, want: developer.ErrHasChildren},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := service.Delete(ctx, tc.id); !errors.Is(err, tc.want) {
				t.Fatalf("got %v want %v", err, tc.want)
			}
		})
	}
	if err := service.Delete(ctx, free.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Get(ctx, free.ID); !errors.Is(err, developer.ErrNotFound) {
		t.Fatalf("developer still present: %v", err)
	}
	if tx.Calls == 0 {
		t.Fatal("delete must run inside a transaction")
	}
}
