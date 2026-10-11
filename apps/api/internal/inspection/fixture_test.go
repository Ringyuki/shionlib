package inspection_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	visitor   = actor.Actor{}
	firstPage = inspection.Page{Number: 1, Size: inspection.MaxPageSize}
)

type fixture struct {
	repo      *inspectiontest.MemoryRepository
	resources *inspectiontest.Resources
	previews  *inspectiontest.PreviewStore
	images    *inspectiontest.ImageShrinker
	clock     time.Time
	resource  int
}

func newFixture() *fixture {
	repo := inspectiontest.NewMemoryRepository()
	return &fixture{
		repo:      repo,
		resources: &inspectiontest.Resources{Visible: map[int][]int{}},
		previews:  inspectiontest.NewPreviewStore(),
		images:    &inspectiontest.ImageShrinker{},
		clock:     time.Now().UTC(),
		resource:  repo.NewResource(),
	}
}

func (f *fixture) records() *inspection.RecordService {
	return inspection.NewRecordService(f.repo, f.previews, f.images, &txtest.Immediate{}, func() time.Time { return f.clock })
}

func (f *fixture) service() *inspection.Service {
	return inspection.NewService(f.repo, f.resources)
}

func (f *fixture) previewService() *inspection.PreviewService {
	return inspection.NewPreviewService(f.repo, f.resources, f.previews)
}

func (f *fixture) record(t *testing.T, draft inspection.Draft) inspection.Recorded {
	t.Helper()
	draft.ResourceID = f.resource
	if draft.Status == "" {
		draft.Status = inspection.StatusReady
	}
	recorded, err := f.records().Record(context.Background(), draft)
	if err != nil {
		t.Fatal(err)
	}
	return recorded
}

func (f *fixture) show(ids ...int) {
	f.resources.Visible[f.resource] = append(f.resources.Visible[f.resource], ids...)
	for _, id := range ids {
		f.repo.Attach(id)
	}
}

func discArchive() inspection.Draft {
	var draft inspection.Draft
	root := draft.AddTop(inspection.DraftEntry{Name: "Annaffiare", Kind: inspection.KindFolder})
	scans := draft.Add(inspection.DraftEntry{Parent: root, Name: "jpg", Kind: inspection.KindFolder})
	draft.Add(inspection.DraftEntry{Parent: scans, Name: "cover10.jpg", Kind: inspection.KindFile, Size: 30})
	draft.Add(inspection.DraftEntry{Parent: scans, Name: "cover2.jpg", Kind: inspection.KindFile, Size: 20})
	disc := draft.Add(inspection.DraftEntry{Parent: root, Name: "ANNA.iso", Kind: inspection.KindDisc, Size: 1000, Detail: inspection.Detail{Label: "ANNA"}})
	game := draft.Add(inspection.DraftEntry{Parent: disc, Name: "Game", Kind: inspection.KindFolder})
	draft.Add(inspection.DraftEntry{Parent: game, Name: "game.exe", Kind: inspection.KindFile, Size: 400})
	bonus := draft.Add(inspection.DraftEntry{Parent: game, Name: "bonus.zip", Kind: inspection.KindArchive, Size: 50})
	draft.Add(inspection.DraftEntry{Parent: bonus, Name: "wallpaper.png", Kind: inspection.KindFile, Size: 80})
	draft.Add(inspection.DraftEntry{Parent: disc, Name: "setup.exe", Kind: inspection.KindFile, Size: 100})
	draft.Add(inspection.DraftEntry{Parent: disc, Name: "Track 02", Kind: inspection.KindTrack, Size: 300, Detail: inspection.Detail{Track: 2, Seconds: 30}})
	draft.Add(inspection.DraftEntry{Parent: root, Name: "ANNA.mds", Kind: inspection.KindFile, Size: 5})
	draft.Add(inspection.DraftEntry{Parent: root, Name: "Empty", Kind: inspection.KindFolder})
	return draft
}
