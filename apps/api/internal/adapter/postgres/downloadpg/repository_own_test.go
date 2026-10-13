package downloadpg_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func TestListOwnResourcesByScope(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice, bob := f.db.User(t), f.db.User(t)
	gameID := f.db.Game(t)
	base := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	hours := func(n int) *time.Time { value := base.Add(time.Duration(n) * time.Hour); return &value }
	at := func(created int, published *time.Time) func(*ent.GameDownloadResourceCreate) {
		return func(c *ent.GameDownloadResourceCreate) {
			c.SetCreated(*hours(created)).SetUpdated(*hours(created)).SetNillablePublishedAt(published)
		}
	}
	onServer := func(check download.CheckStatus) func(*ent.GameDownloadResourceFileCreate) {
		return func(c *ent.GameDownloadResourceFileCreate) {
			c.SetFileStatus(download.FileOnServer).SetFileCheckStatus(int(check))
		}
	}

	downloaded := func(count int) func(*ent.GameDownloadResourceCreate) {
		return func(c *ent.GameDownloadResourceCreate) { c.SetDownloads(count) }
	}
	early := f.resource(t, gameID, alice, at(1, hours(9)), downloaded(20))
	f.file(t, early.ID, alice, "early.7z")
	late := f.resource(t, gameID, alice, at(2, hours(8)), downloaded(40))
	f.file(t, late.ID, alice, "late.7z")
	linked := f.resource(t, gameID, alice, at(3, hours(7)))
	f.file(t, linked.ID, alice, "mirror", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetType(download.FileTypeDirectLink).SetFileStatus(download.FilePending)
	})
	growing := f.resource(t, gameID, alice, at(4, hours(6)))
	f.file(t, growing.ID, alice, "part1.rar")
	f.file(t, growing.ID, alice, "part2.rar", onServer(download.CheckOK))
	held := f.resource(t, gameID, alice, at(5, hours(5)))
	f.file(t, held.ID, alice, "patch.exe", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileCheckStatus(int(download.CheckHarmfulPendingReview))
	})
	fresh := f.resource(t, gameID, alice, at(6, nil))
	f.file(t, fresh.ID, alice, "fresh.7z", onServer(download.CheckPending))
	removed := f.resource(t, gameID, alice, at(7, nil), func(c *ent.GameDownloadResourceCreate) { c.SetStatus(download.ResourceRemoved) })
	f.file(t, removed.ID, alice, "removed.7z", onServer(download.CheckPending))
	theirs := f.resource(t, gameID, bob, at(8, nil))
	f.file(t, theirs.ID, bob, "theirs.7z", onServer(download.CheckPending))
	summer := f.db.Game(t, func(c *ent.GameCreate) {
		c.SetTitleJp("Summer Pockets").SetTitleZh("夏日口袋").SetAliases(pgvalue.Strings{"Samapoke"})
	})
	titled := f.resource(t, summer, alice, at(0, hours(1)))
	f.file(t, titled.ID, alice, "sp.7z")

	ids := func(resources []download.GameResource) []int {
		out := make([]int, len(resources))
		for i, resource := range resources {
			out[i] = resource.ID
		}
		return out
	}
	ten := download.Page{Number: 1, Size: 10}

	processing, total, err := f.repo.ListOwnResources(ctx, alice, download.OwnQuery{Scope: download.OwnProcessing}, ten)
	if err != nil {
		t.Fatal(err)
	}
	if total != 3 || !slices.Equal(ids(processing), []int{fresh.ID, held.ID, growing.ID}) {
		t.Fatalf("unpublished resources and those with a file not stored or under review, last updated first: %d %v", total, ids(processing))
	}
	if files := processing[2].Files; len(files) != 2 || files[0].Name != "part1.rar" || files[1].Stage() != download.StageStoring || files[1].Creator.ID != alice || processing[2].Creator.ID != alice {
		t.Fatalf("each one carries its files in order with their creators: %+v", processing[2])
	}
	for _, resource := range processing {
		if !resource.In(download.OwnProcessing) {
			t.Fatalf("the query and the model disagree on %+v", resource)
		}
	}

	published, total, err := f.repo.ListOwnResources(ctx, alice, download.OwnQuery{Scope: download.OwnPublished}, download.Page{Number: 1, Size: 2})
	if err != nil || total != 4 || !slices.Equal(ids(published), []int{linked.ID, late.ID}) {
		t.Fatalf("published resources, last updated first: %d %v %v", total, ids(published), err)
	}
	next, _, err := f.repo.ListOwnResources(ctx, alice, download.OwnQuery{Scope: download.OwnPublished}, download.Page{Number: 2, Size: 2})
	if err != nil || !slices.Equal(ids(next), []int{early.ID, titled.ID}) || !next[0].In(download.OwnPublished) {
		t.Fatalf("second page: %v %v", ids(next), err)
	}

	all, total, err := f.repo.ListOwnResources(ctx, alice, download.OwnQuery{Scope: download.OwnAll, Sort: download.OwnSortDownloads}, ten)
	if err != nil || total != 7 || all[0].ID != late.ID || all[1].ID != early.ID {
		t.Fatalf("every active resource, most downloaded first: %d %v %v", total, ids(all), err)
	}
	least, _, err := f.repo.ListOwnResources(ctx, alice, download.OwnQuery{Scope: download.OwnAll, Sort: download.OwnSortDownloads, Ascending: true}, ten)
	if err != nil || least[len(least)-1].ID != late.ID {
		t.Fatalf("least downloaded first: %v %v", ids(least), err)
	}

	for search, want := range map[string][]int{
		"SUMMER":   {titled.ID},
		"夏日":       {titled.ID},
		"samapoke": {titled.ID},
		"part2":    {growing.ID},
		"100%":     {},
	} {
		found, _, err := f.repo.ListOwnResources(ctx, alice, download.OwnQuery{Scope: download.OwnAll, Search: search}, ten)
		if err != nil || !slices.Equal(ids(found), want) {
			t.Fatalf("search %q: %v %v, want %v", search, ids(found), err, want)
		}
	}

	summary, err := f.repo.SummarizeOwnResources(ctx, alice, *hours(4))
	if err != nil || summary != (download.OwnSummary{Processing: 3, Published: 4, Downloads: 60, Games: 2, Files: 8, Recent: 3}) {
		t.Fatalf("summary of active resources, their games and files, and those created since the fourth hour: %+v %v", summary, err)
	}
	nobody, err := f.repo.SummarizeOwnResources(ctx, f.db.User(t), *hours(4))
	if err != nil || nobody != (download.OwnSummary{}) {
		t.Fatalf("someone without resources: %+v %v", nobody, err)
	}
}
