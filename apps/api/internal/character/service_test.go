package character_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/character/charactertest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func TestDelete(t *testing.T) {
	ctx := context.Background()
	repo := charactertest.NewMemoryRepository()
	tx := &txtest.Immediate{}
	service := character.NewService(repo, tx)
	linked := repo.Seed(character.Character{NameJP: "linked"})
	free := repo.Seed(character.Character{NameJP: "free"})
	repo.Link(linked.ID)

	if _, err := service.Delete(ctx, 999); !errors.Is(err, character.ErrNotFound) {
		t.Fatalf("missing character: %v", err)
	}
	if _, err := service.Delete(ctx, linked.ID); !errors.Is(err, character.ErrHasRelations) {
		t.Fatalf("linked character: %v", err)
	}
	deleted, err := service.Delete(ctx, free.ID)
	if err != nil {
		t.Fatal(err)
	}
	if deleted.ID != free.ID || deleted.NameJP != "free" {
		t.Fatalf("delete must return the removed row: %+v", deleted)
	}
	if tx.Calls == 0 {
		t.Fatal("delete must run inside a transaction")
	}
	if _, err := service.Get(ctx, free.ID); !errors.Is(err, character.ErrNotFound) {
		t.Fatalf("character still present: %v", err)
	}
}

func TestListTrimsTheQuery(t *testing.T) {
	repo := charactertest.NewMemoryRepository()
	repo.Seed(character.Character{NameJP: "Leaf"})
	repo.Seed(character.Character{NameJP: "Moon"})
	service := character.NewService(repo, &txtest.Immediate{})
	items, total, err := service.List(context.Background(), "  leaf ", character.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || items[0].NameJP != "Leaf" {
		t.Fatalf("unexpected list %+v %d %v", items, total, err)
	}
}
