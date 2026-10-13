package inspection_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
)

func TestMediumServiceReadsTheFormatOfTheDiscImagesFound(t *testing.T) {
	ctx := context.Background()
	repo := inspectiontest.NewMemoryRepository()
	service := inspection.NewMediumService(repo)
	resource := repo.NewResource()
	id, err := repo.Create(ctx, inspection.NewInspection{ResourceID: resource, Status: inspection.StatusReady, Archive: inspection.Archive{Format: "rar", Recovery: true, RecoveryPercent: 3}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.AddEntries(ctx, id, []inspection.NewEntry{
		{Position: 0, Name: "GAME.iso", Kind: inspection.KindDisc},
		{Position: 1, Name: "GAME.mds", Kind: inspection.KindFile},
		{Position: 2, Name: "readme.txt", Kind: inspection.KindFile},
	}); err != nil {
		t.Fatal(err)
	}
	if medium, err := service.Medium(ctx, id); err != nil || medium != "iso+mds+rr3" {
		t.Fatalf("medium %q %v", medium, err)
	}
	plain, err := repo.Create(ctx, inspection.NewInspection{ResourceID: resource, Status: inspection.StatusReady, Archive: inspection.Archive{Format: "7z"}})
	if err != nil {
		t.Fatal(err)
	}
	if medium, err := service.Medium(ctx, plain); err != nil || medium != "" {
		t.Fatalf("an archive without disc images has no medium: %q %v", medium, err)
	}
	if medium, err := service.Medium(ctx, 987654); err != nil || medium != "" {
		t.Fatalf("an inspection that is gone has no medium: %q %v", medium, err)
	}
}
