package analysispg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/analysispg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
)

func TestStats(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	stats := analysispg.NewStatsStore(db.Ent)
	creator := db.User(t)

	published := db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("公開").SetTitleZh("公开").SetTitleEn("Public") })
	hidden := db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) })
	rated := db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	coverRated := db.Game(t)
	if err := db.Ent.GameCover.Create().SetGameID(coverRated).SetLanguage("jp").SetType("pkgfront").SetURL("x").SetDims(pgvalue.Ints{1, 1}).SetSexual(2).SetViolence(0).Exec(ctx); err != nil {
		t.Fatal(err)
	}

	resource := func(gameID int) int {
		row, err := db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(creator).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return row.ID
	}
	file := func(resourceID, kind, status int, size int64) int {
		row, err := db.Ent.GameDownloadResourceFile.Create().
			SetGameDownloadResourceID(resourceID).
			SetCreatorID(creator).
			SetType(kind).
			SetFileStatus(status).
			SetFileName("f.zip").
			SetFileHash("h").
			SetFileSize(size).
			Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return row.ID
	}
	publicResource := resource(published)
	resource(hidden)
	ratedResource := resource(rated)
	stored := file(publicResource, 1, 3, 1000)
	file(publicResource, 1, 1, 50)
	file(publicResource, 2, 1, 0)
	ratedFile := file(ratedResource, 1, 3, 24)

	totals, err := stats.Totals(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if totals.Games != 3 || totals.Files != 3 || totals.Resources != 2 || totals.StorageBytes != 1024 {
		t.Fatalf("unexpected totals %+v", totals)
	}

	refs, err := stats.Games(ctx, []int{published, rated, coverRated, 987654})
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 3 || refs[published].Titles.EN != "Public" || refs[published].Rated || !refs[rated].Rated || !refs[coverRated].Rated {
		t.Fatalf("unexpected game refs %+v", refs)
	}
	ratedFiles, err := stats.RatedFiles(ctx, []int{stored, ratedFile})
	if err != nil {
		t.Fatal(err)
	}
	if ratedFiles[stored] || !ratedFiles[ratedFile] {
		t.Fatalf("unexpected rated files %+v", ratedFiles)
	}
	if empty, err := stats.Games(ctx, nil); err != nil || len(empty) != 0 {
		t.Fatalf("no ids: %v %v", empty, err)
	}
}
