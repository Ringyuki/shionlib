package inspection_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
)

func TestListingsOfInspections(t *testing.T) {
	ctx := context.Background()
	repo := inspectiontest.NewMemoryRepository()
	id, err := repo.Create(ctx, inspection.NewInspection{ResourceID: repo.NewResource(), Status: inspection.StatusReady, Totals: inspection.Totals{Files: 2, Size: 30}})
	if err != nil {
		t.Fatal(err)
	}
	top, err := repo.AddEntries(ctx, id, []inspection.NewEntry{{Name: "Game", Kind: inspection.KindFolder}, {Name: "readme.txt", Kind: inspection.KindFile, Size: 10, Position: 1}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.AddEntries(ctx, id, []inspection.NewEntry{{ParentID: &top[0], Name: "game.exe", Kind: inspection.KindFile, Size: 20}}); err != nil {
		t.Fatal(err)
	}
	listings := inspection.NewListingService(repo)

	facts, err := listings.Facts(ctx, []int{id, id + 5})
	if err != nil || len(facts) != 1 || facts[id].Totals.Size != 30 {
		t.Fatalf("facts by inspection: %+v %v", facts, err)
	}
	files, err := listings.Files(ctx, id)
	if err != nil || len(files) != 2 || files[0] != (inspection.FilePath{Path: "readme.txt", Size: 10}) && files[1] != (inspection.FilePath{Path: "readme.txt", Size: 10}) {
		t.Fatalf("files: %+v %v", files, err)
	}
}
