package inspectiontest

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type Env struct {
	Repo        inspection.Repository
	NewResource func(t *testing.T) int
	Attach      func(t *testing.T, inspectionID int)
}

var firstPage = inspection.Page{Number: 1, Size: inspection.MaxPageSize}

func names[T any](items []T, name func(T) string) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = name(item)
	}
	return out
}

func entryName(entry inspection.Entry) string { return entry.Name }

func foundName(found inspection.Found) string { return found.Name }

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("an inspection keeps every fact it was created with", func(t *testing.T) {
		env := newEnv(t)
		resource := env.NewResource(t)
		signatures := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
		scanned := time.Date(2026, 10, 11, 8, 30, 0, 0, time.UTC)
		id, err := env.Repo.Create(ctx, inspection.NewInspection{
			ResourceID: resource,
			Status:     inspection.StatusReady,
			Archive:    inspection.Archive{Format: "rar5", Solid: true, Volumes: 3, Recovery: true, RecoveryPercent: 3, NameEncoding: "shift_jis", Unsupported: true},
			Totals:     inspection.Totals{Files: 6, Folders: 2, Size: 2_480_000_000, Discs: 1, DiscFiles: 23},
			Truncated:  true,
			Verified:   true,
			Scan: inspection.Scan{
				Engine:       "ClamAV 1.4.3",
				SignaturesAt: &signatures,
				Scanned:      5,
				Skipped:      []string{"Game/data.exe"},
				Limit:        4000 << 20,
				Detections:   []inspection.Detection{{Path: "Game/steam_api.dll", Signature: "Win.Malware.Generic-9917"}},
				At:           &scanned,
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		if got.ID != id || got.ResourceID != resource || got.Status != inspection.StatusReady || !got.Truncated || !got.Verified || got.Created.IsZero() {
			t.Fatalf("unexpected inspection %+v", got)
		}
		if got.Archive != (inspection.Archive{Format: "rar5", Solid: true, Volumes: 3, Recovery: true, RecoveryPercent: 3, NameEncoding: "shift_jis", Unsupported: true}) {
			t.Fatalf("unexpected archive %+v", got.Archive)
		}
		if got.Totals != (inspection.Totals{Files: 6, Folders: 2, Size: 2_480_000_000, Discs: 1, DiscFiles: 23}) {
			t.Fatalf("unexpected totals %+v", got.Totals)
		}
		scan := got.Scan
		if scan.Engine != "ClamAV 1.4.3" || scan.SignaturesAt == nil || !scan.SignaturesAt.Equal(signatures) || scan.Scanned != 5 || scan.Limit != 4000<<20 || scan.At == nil || !scan.At.Equal(scanned) || scan.ClearedAt != nil {
			t.Fatalf("unexpected scan %+v", scan)
		}
		if !slices.Equal(scan.Skipped, []string{"Game/data.exe"}) || !slices.Equal(scan.Detections, []inspection.Detection{{Path: "Game/steam_api.dll", Signature: "Win.Malware.Generic-9917"}}) {
			t.Fatalf("unexpected scan lists %+v", scan)
		}
		cleared := time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC)
		if err := env.Repo.MarkCleared(ctx, []int{id}, cleared); err != nil {
			t.Fatal(err)
		}
		if got, err := env.Repo.Get(ctx, id); err != nil || got.Scan.ClearedAt == nil || !got.Scan.ClearedAt.Equal(cleared) {
			t.Fatalf("cleared: %+v %v", got.Scan, err)
		}
		plain, err := env.Repo.Create(ctx, inspection.NewInspection{ResourceID: resource, Status: inspection.StatusPlain})
		if err != nil {
			t.Fatal(err)
		}
		if got, err := env.Repo.Get(ctx, plain); err != nil || got.Scan.Skipped == nil || len(got.Scan.Skipped) != 0 || len(got.Scan.Detections) != 0 {
			t.Fatalf("empty lists must come back empty: %+v %v", got.Scan, err)
		}
		found, err := env.Repo.ByIDs(ctx, []int{plain, id, 987654})
		if err != nil || len(found) != 2 || found[0].ID != id || found[1].ID != plain {
			t.Fatalf("by ids: %+v %v", found, err)
		}
	})

	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if err := env.Repo.Delete(ctx, 987654); !errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("delete: %v", err)
		}
		if _, err := env.Repo.GetEntry(ctx, 987654); !errors.Is(err, inspection.ErrEntryNotFound) {
			t.Fatalf("get entry: %v", err)
		}
		if err := env.Repo.SetPreview(ctx, 987654, inspection.PreviewText); !errors.Is(err, inspection.ErrEntryNotFound) {
			t.Fatalf("set preview: %v", err)
		}
		if _, err := env.Repo.Create(ctx, inspection.NewInspection{ResourceID: 987654, Status: inspection.StatusReady}); !errors.Is(err, inspection.ErrResourceGone) {
			t.Fatalf("create for a missing resource: %v", err)
		}
		if _, err := env.Repo.AddEntries(ctx, 987654, []inspection.NewEntry{{Name: "a", Kind: inspection.KindFile}}); !errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("add entries to a missing inspection: %v", err)
		}
	})

	t.Run("entries are listed by parent in their positions and found by name", func(t *testing.T) {
		env := newEnv(t)
		id, err := env.Repo.Create(ctx, inspection.NewInspection{ResourceID: env.NewResource(t), Status: inspection.StatusReady})
		if err != nil {
			t.Fatal(err)
		}
		modified := time.Date(2013, 7, 27, 12, 0, 0, 0, time.UTC)
		top, err := env.Repo.AddEntries(ctx, id, []inspection.NewEntry{
			{Position: 1, Name: "ANNA.iso", Kind: inspection.KindDisc, Size: 2_290_000_000, Modified: &modified, Items: 3, Children: 2, Detail: inspection.Detail{Format: "iso9660+joliet", Label: "ANNAFFIARE", Files: 3, Folders: 1, Signals: []string{"dpm"}}},
			{Position: 0, Name: "jpg", Kind: inspection.KindFolder, Size: 12, Items: 1, Children: 1},
			{Position: 2, Name: "update.rar", Kind: inspection.KindArchive, Size: 9, Encrypted: true, Unreadable: true},
		})
		if err != nil || len(top) != 3 {
			t.Fatalf("add top entries: %v %v", top, err)
		}
		inner, err := env.Repo.AddEntries(ctx, id, []inspection.NewEntry{
			{ParentID: &top[0], Position: 1, Name: "Setup.EXE", Kind: inspection.KindFile, Size: 100},
			{ParentID: &top[0], Position: 0, Name: "Game", Kind: inspection.KindFolder, Items: 2, Children: 2},
			{ParentID: &top[1], Position: 0, Name: "cover_100%.jpg", Kind: inspection.KindFile, Size: 12},
		})
		if err != nil || len(inner) != 3 {
			t.Fatalf("add inner entries: %v %v", inner, err)
		}
		deep, err := env.Repo.AddEntries(ctx, id, []inspection.NewEntry{
			{ParentID: &inner[1], Position: 0, Name: "game.exe", Kind: inspection.KindFile, Size: 7},
			{ParentID: &inner[1], Position: 1, Name: "音轨 02", Kind: inspection.KindTrack, Size: 5, Detail: inspection.Detail{Track: 2, Seconds: 271}},
		})
		if err != nil || len(deep) != 2 {
			t.Fatalf("add deep entries: %v %v", deep, err)
		}

		roots, total, err := env.Repo.Children(ctx, id, nil, firstPage)
		if err != nil || total != 3 || !slices.Equal(names(roots, entryName), []string{"jpg", "ANNA.iso", "update.rar"}) {
			t.Fatalf("roots: %v %d %v", names(roots, entryName), total, err)
		}
		disc := roots[1]
		if disc.ID != top[0] || disc.InspectionID != id || disc.ParentID != nil || disc.Kind != inspection.KindDisc || disc.Size != 2_290_000_000 || disc.Modified == nil || !disc.Modified.Equal(modified) || disc.Items != 3 || disc.Children != 2 {
			t.Fatalf("unexpected disc %+v", disc)
		}
		if disc.Detail.Format != "iso9660+joliet" || disc.Detail.Label != "ANNAFFIARE" || disc.Detail.Files != 3 || disc.Detail.Folders != 1 || !slices.Equal(disc.Detail.Signals, []string{"dpm"}) {
			t.Fatalf("unexpected disc detail %+v", disc.Detail)
		}
		if locked := roots[2]; !locked.Encrypted || !locked.Unreadable || !locked.Detail.Empty() {
			t.Fatalf("unexpected encrypted archive %+v", locked)
		}
		inDisc, total, err := env.Repo.Children(ctx, id, &top[0], firstPage)
		if err != nil || total != 2 || !slices.Equal(names(inDisc, entryName), []string{"Game", "Setup.EXE"}) || inDisc[0].ParentID == nil || *inDisc[0].ParentID != top[0] {
			t.Fatalf("disc children: %+v %d %v", inDisc, total, err)
		}
		second, total, err := env.Repo.Children(ctx, id, nil, inspection.Page{Number: 2, Size: 2})
		if err != nil || total != 3 || !slices.Equal(names(second, entryName), []string{"update.rar"}) {
			t.Fatalf("second page: %v %d %v", names(second, entryName), total, err)
		}
		if beyond, total, err := env.Repo.Children(ctx, id, nil, inspection.Page{Number: 5, Size: 2}); err != nil || total != 3 || len(beyond) != 0 {
			t.Fatalf("beyond the last page: %v %d %v", beyond, total, err)
		}

		track, err := env.Repo.GetEntry(ctx, deep[1])
		if err != nil || track.Kind != inspection.KindTrack || track.Detail.Track != 2 || track.Detail.Seconds != 271 {
			t.Fatalf("track: %+v %v", track, err)
		}
		discs, err := env.Repo.Discs(ctx, []int{id})
		if err != nil || len(discs) != 1 || discs[0].ID != top[0] {
			t.Fatalf("discs: %+v %v", discs, err)
		}

		found, total, err := env.Repo.Search(ctx, id, "EXE", firstPage)
		if err != nil || total != 2 || !slices.Equal(names(found, foundName), []string{"game.exe", "Setup.EXE"}) {
			t.Fatalf("search: %v %d %v", names(found, foundName), total, err)
		}
		if found[0].Location != "ANNA.iso/Game" || found[1].Location != "ANNA.iso" {
			t.Fatalf("locations: %q %q", found[0].Location, found[1].Location)
		}
		if top, _, err := env.Repo.Search(ctx, id, "update", firstPage); err != nil || len(top) != 1 || top[0].Location != "" {
			t.Fatalf("a match at the top has no location: %+v %v", top, err)
		}
		if folders, total, err := env.Repo.Search(ctx, id, "jpg", firstPage); err != nil || total != 1 || folders[0].Name != "cover_100%.jpg" {
			t.Fatalf("folders are not matched: %+v %d %v", folders, total, err)
		}
		if literal, total, err := env.Repo.Search(ctx, id, "100%", firstPage); err != nil || total != 1 || len(literal) != 1 {
			t.Fatalf("wildcard characters match literally: %+v %d %v", literal, total, err)
		}
		if literal, total, err := env.Repo.Search(ctx, id, "c_ver", firstPage); err != nil || total != 0 || len(literal) != 0 {
			t.Fatalf("an underscore is not a wildcard: %+v %d %v", literal, total, err)
		}
		if paged, total, err := env.Repo.Search(ctx, id, "e", inspection.Page{Number: 2, Size: 2}); err != nil || total != 4 || len(paged) != 2 {
			t.Fatalf("search pages: %+v %d %v", paged, total, err)
		}
	})

	t.Run("previews are flagged per entry and listed for removal", func(t *testing.T) {
		env := newEnv(t)
		id, err := env.Repo.Create(ctx, inspection.NewInspection{ResourceID: env.NewResource(t), Status: inspection.StatusReady})
		if err != nil {
			t.Fatal(err)
		}
		ids, err := env.Repo.AddEntries(ctx, id, []inspection.NewEntry{
			{Name: "readme.txt", Kind: inspection.KindFile},
			{Name: "cover.jpg", Kind: inspection.KindFile, Position: 1},
			{Name: "game.exe", Kind: inspection.KindFile, Position: 2},
		})
		if err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SetPreview(ctx, ids[0], inspection.PreviewText); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SetPreview(ctx, ids[1], inspection.PreviewImage); err != nil {
			t.Fatal(err)
		}
		if entry, err := env.Repo.GetEntry(ctx, ids[1]); err != nil || entry.Preview != inspection.PreviewImage {
			t.Fatalf("entry: %+v %v", entry, err)
		}
		if entry, err := env.Repo.GetEntry(ctx, ids[2]); err != nil || entry.Preview != inspection.PreviewNone {
			t.Fatalf("entry without preview: %+v %v", entry, err)
		}
		kept, err := env.Repo.PreviewEntries(ctx, id)
		if err != nil || !slices.Equal(kept, []int{ids[0], ids[1]}) {
			t.Fatalf("preview entries: %v %v", kept, err)
		}
	})

	t.Run("an inspection no file refers to is an orphan once it is old enough", func(t *testing.T) {
		env := newEnv(t)
		resource := env.NewResource(t)
		create := func() int {
			id, err := env.Repo.Create(ctx, inspection.NewInspection{ResourceID: resource, Status: inspection.StatusReady})
			if err != nil {
				t.Fatal(err)
			}
			return id
		}
		attached, first, second := create(), create(), create()
		env.Attach(t, attached)
		entries, err := env.Repo.AddEntries(ctx, first, []inspection.NewEntry{{Name: "a.txt", Kind: inspection.KindFile}})
		if err != nil {
			t.Fatal(err)
		}
		later := time.Now().Add(time.Hour)
		if orphans, err := env.Repo.Orphans(ctx, later, 10); err != nil || !slices.Equal(orphans, []int{first, second}) {
			t.Fatalf("orphans: %v %v", orphans, err)
		}
		if orphans, err := env.Repo.Orphans(ctx, later, 1); err != nil || !slices.Equal(orphans, []int{first}) {
			t.Fatalf("limited orphans: %v %v", orphans, err)
		}
		if orphans, err := env.Repo.Orphans(ctx, time.Now().Add(-time.Hour), 10); err != nil || len(orphans) != 0 {
			t.Fatalf("recent inspections are kept: %v %v", orphans, err)
		}
		if err := env.Repo.Delete(ctx, first); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Get(ctx, first); !errors.Is(err, inspection.ErrNotFound) {
			t.Fatalf("deleted inspection: %v", err)
		}
		if _, err := env.Repo.GetEntry(ctx, entries[0]); !errors.Is(err, inspection.ErrEntryNotFound) {
			t.Fatalf("entries go with their inspection: %v", err)
		}
	})
}
