package inspection_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func TestOfResourceListsTheInspectionsOfTheVisibleFilesWithTheirDiscImages(t *testing.T) {
	f := newFixture()
	var plain inspection.Draft
	plain.AddTop(inspection.DraftEntry{Name: "bonus.png", Kind: inspection.KindFile, Size: 3})
	withDisc, bonus, hidden := f.record(t, discArchive()), f.record(t, plain), f.record(t, plain)
	f.show(bonus.ID, withDisc.ID)
	views, err := f.service().OfResource(context.Background(), visitor, f.resource)
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 2 || views[0].ID != bonus.ID || views[1].ID != withDisc.ID {
		t.Fatalf("views follow the files of the resource and leave out %d: %+v", hidden.ID, views)
	}
	if views[0].Discs == nil || len(views[0].Discs) != 0 {
		t.Fatalf("an archive without images lists none: %+v", views[0].Discs)
	}
	if len(views[1].Discs) != 1 || views[1].Discs[0].Name != "ANNA.iso" || views[1].Discs[0].Items != 4 {
		t.Fatalf("unexpected disc images %+v", views[1].Discs)
	}
}

func TestOfResourceIsEmptyBeforeAnyFileWasRead(t *testing.T) {
	f := newFixture()
	views, err := f.service().OfResource(context.Background(), visitor, f.resource)
	if err != nil || views == nil || len(views) != 0 {
		t.Fatalf("views: %+v %v", views, err)
	}
}

func TestOfResourceReportsAResourceTheViewerCannotSee(t *testing.T) {
	f := newFixture()
	f.resources.Err = download.ErrResourceNotFound
	if _, err := f.service().OfResource(context.Background(), visitor, f.resource); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("of resource: %v", err)
	}
}

func TestChildrenAndSearchReadAVisibleInspection(t *testing.T) {
	f := newFixture()
	recorded := f.record(t, discArchive())
	f.show(recorded.ID)
	roots, total, err := f.service().Children(context.Background(), visitor, recorded.ID, nil, firstPage)
	if err != nil || total != 1 || roots[0].Name != "Annaffiare" {
		t.Fatalf("roots: %+v %d %v", roots, total, err)
	}
	inside, total, err := f.service().Children(context.Background(), visitor, recorded.ID, &roots[0].ID, firstPage)
	if err != nil || total != 4 || len(inside) != 4 {
		t.Fatalf("children: %+v %d %v", inside, total, err)
	}
	found, total, err := f.service().Search(context.Background(), visitor, recorded.ID, "  EXE ", firstPage)
	if err != nil || total != 2 {
		t.Fatalf("search: %+v %d %v", found, total, err)
	}
	locations := []string{found[0].Location, found[1].Location}
	if !slices.Equal(locations, []string{"Annaffiare/ANNA.iso/Game", "Annaffiare/ANNA.iso"}) {
		t.Fatalf("locations: %v", locations)
	}
	if blank, total, err := f.service().Search(context.Background(), visitor, recorded.ID, "   ", firstPage); err != nil || total != 0 || blank == nil || len(blank) != 0 {
		t.Fatalf("a blank query matches nothing: %+v %d %v", blank, total, err)
	}
}

func TestAnInspectionOutsideTheViewersReachDoesNotExist(t *testing.T) {
	f := newFixture()
	recorded := f.record(t, discArchive())
	read := func() []error {
		_, _, children := f.service().Children(context.Background(), visitor, recorded.ID, nil, firstPage)
		_, _, search := f.service().Search(context.Background(), visitor, recorded.ID, "exe", firstPage)
		return []error{children, search}
	}
	for _, err := range read() {
		if !errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("an inspection no visible file refers to: %v", err)
		}
	}
	f.resources.Err = download.ErrResourceNotFound
	for _, err := range read() {
		if !errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("a hidden resource: %v", err)
		}
	}
	down := errors.New("database unavailable")
	f.resources.Err = down
	for _, err := range read() {
		if !errors.Is(err, down) || errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("a failure is not a missing inspection: %v", err)
		}
	}
	if _, _, err := f.service().Children(context.Background(), visitor, 987654, nil, firstPage); !errors.Is(err, inspection.ErrNotFound) {
		t.Fatalf("a missing inspection: %v", err)
	}
}
