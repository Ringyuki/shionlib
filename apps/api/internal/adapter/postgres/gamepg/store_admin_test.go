package gamepg_test

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

func cover(t *testing.T, db *pgtest.DB, gameID int, url string) {
	t.Helper()
	db.Ent.GameCover.Create().SetGameID(gameID).SetLanguage("jp").SetURL(url).SetType("pkgfront").SetSexual(0).SetViolence(0).SaveX(context.Background())
}

func TestAdminSearchFiltersSortsAndPicksTheFirstCover(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := gamepg.NewAdminStore(db.Ent)
	first := db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("Alpha ゲーム").SetViews(5).SetDownloads(1) })
	second := db.Game(t, func(c *ent.GameCreate) {
		c.SetTitleZh("贝塔").SetTitleEn("Beta").SetViews(9).SetStatus(2).SetNsfw(true)
	})
	third := db.Game(t, func(c *ent.GameCreate) { c.SetTitleEn("beta two").SetViews(1) })
	cover(t, db, second, "b-first.webp")
	cover(t, db, second, "b-second.webp")

	entries, total, err := store.Search(ctx, game.AdminFilter{SortBy: game.AdminSortByViews, Descending: true}, game.Page{Number: 1, Size: 2})
	if err != nil || total != 3 || len(entries) != 2 || entries[0].ID != second || entries[1].ID != first {
		t.Fatalf("sorted page: %+v %d %v", entries, total, err)
	}
	hidden := entries[0]
	if hidden.Cover == nil || hidden.Cover.URL != "b-first.webp" || !hidden.NSFW || hidden.Status != game.StatusHidden || hidden.Creator.ID == 0 || hidden.Creator.Name == "" {
		t.Fatalf("entry fields: %+v", hidden)
	}
	if entries[1].Cover != nil {
		t.Fatalf("games without covers have no cover: %+v", entries[1])
	}

	entries, total, err = store.Search(ctx, game.AdminFilter{Search: "BETA", SortBy: game.AdminSortByID}, game.Page{Number: 1, Size: 10})
	if err != nil || total != 2 || !slices.Equal(entryIDs(entries), []int{second, third}) {
		t.Fatalf("title search is case-insensitive across languages: %v %d %v", entryIDs(entries), total, err)
	}
	visible := game.StatusVisible
	entries, total, err = store.Search(ctx, game.AdminFilter{Status: &visible, SortBy: game.AdminSortByID, Descending: true}, game.Page{Number: 1, Size: 10})
	if err != nil || total != 2 || !slices.Equal(entryIDs(entries), []int{third, first}) {
		t.Fatalf("status filter: %v %d %v", entryIDs(entries), total, err)
	}
	entries, total, err = store.Search(ctx, game.AdminFilter{Search: strconv.Itoa(third), SortBy: game.AdminSortByID}, game.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || entries[0].ID != third {
		t.Fatalf("a number finds the game with that id: %v %d %v", entryIDs(entries), total, err)
	}
}

func TestAdminSearchCountsPublishedResourcesAndNamesTheSource(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := gamepg.NewAdminStore(db.Ent)
	sourced := db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("sourced") })
	bare := db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("bare") })
	published := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	creator := db.User(t)
	resource := func(status int, publishedAt *time.Time) {
		t.Helper()
		db.Ent.GameDownloadResource.Create().
			SetGameID(sourced).
			SetCreatorID(creator).
			SetPlatform([]string{"win"}).
			SetLanguage([]string{"zh"}).
			SetStatus(status).
			SetNillablePublishedAt(publishedAt).
			ExecX(ctx)
	}
	resource(download.ResourceActive, &published)
	resource(download.ResourceActive, &published)
	resource(download.ResourceActive, nil)
	resource(download.ResourceActive+1, &published)
	link := func(source, externalID string, excludedAt *time.Time) {
		t.Helper()
		db.Ent.CatalogSourceLink.Create().
			SetSource(source).
			SetEntity(string(catalog.EntityGame)).
			SetExternalID(externalID).
			SetLocalID(sourced).
			SetNillableExcludedAt(excludedAt).
			ExecX(ctx)
	}
	link("retired", "9", &published)
	link("hikarinagi", "18342", nil)

	entries, _, err := store.Search(ctx, game.AdminFilter{SortBy: game.AdminSortByID}, game.Page{Number: 1, Size: 10})
	if err != nil || len(entries) != 2 || entries[0].ID != sourced || entries[1].ID != bare {
		t.Fatalf("entries: %+v %v", entries, err)
	}
	if entries[0].Resources != 2 || entries[0].Source == nil || *entries[0].Source != (game.SourceRef{Source: "hikarinagi", ExternalID: "18342"}) {
		t.Fatalf("published resources and the source still in use: %+v", entries[0])
	}
	if entries[1].Resources != 0 || entries[1].Source != nil {
		t.Fatalf("a game without resources or source: %+v", entries[1])
	}
}

func entryIDs(entries []game.AdminEntry) []int {
	out := make([]int, len(entries))
	for i, entry := range entries {
		out[i] = entry.ID
	}
	return out
}

func TestAdminScalarRoundTrip(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := gamepg.NewAdminStore(db.Ent)
	id := db.Game(t, func(c *ent.GameCreate) { c.SetBID("100").SetVID("v100") })
	other := db.Game(t, func(c *ent.GameCreate) { c.SetBID("200").SetVID("v200") })

	scalar, err := store.Scalar(ctx, id)
	if err != nil || scalar.BID == nil || *scalar.BID != "100" || string(scalar.ExtraInfo) != `[]` || string(scalar.Staffs) != `[]` || scalar.Aliases == nil || scalar.Platform == nil || scalar.Status != game.StatusVisible {
		t.Fatalf("defaults: %+v %v", scalar, err)
	}

	release := time.Date(2020, 1, 2, 0, 0, 0, 0, time.UTC)
	title, aliases, platform, tba, hidden := "新标题", []string{"a", "b"}, []string{"win"}, true, game.StatusHidden
	extra := []game.ExtraInfo{{Key: "k", Value: "v"}}
	staffs := []game.Staff{{Name: "n", Role: "r"}}
	err = store.UpdateScalar(ctx, id, game.ScalarChanges{
		BID:            patch.Clearable[string]{Set: true},
		Type:           patch.Clearable[string]{Set: true, Value: new("ADV")},
		ReleaseDate:    patch.Clearable[time.Time]{Set: true, Value: &release},
		TitleZH:        &title,
		Aliases:        &aliases,
		Platform:       &platform,
		ReleaseDateTBA: &tba,
		Status:         &hidden,
		ExtraInfo:      patch.Clearable[[]game.ExtraInfo]{Set: true, Value: &extra},
		Staffs:         patch.Clearable[[]game.Staff]{Set: true, Value: &staffs},
	})
	if err != nil {
		t.Fatal(err)
	}
	scalar, _ = store.Scalar(ctx, id)
	if scalar.BID != nil || scalar.VID == nil || *scalar.VID != "v100" || scalar.Type == nil || *scalar.Type != "ADV" || scalar.ReleaseDate == nil || !scalar.ReleaseDate.Equal(release) ||
		scalar.TitleZH != title || !slices.Equal(scalar.Aliases, aliases) || !slices.Equal(scalar.Platform, platform) || !scalar.ReleaseDateTBA || scalar.Status != hidden {
		t.Fatalf("updated scalar: %+v", scalar)
	}
	if string(scalar.ExtraInfo) != `[{"key": "k", "value": "v"}]` || string(scalar.Staffs) != `[{"name": "n", "role": "r"}]` {
		t.Fatalf("json columns: %s %s", scalar.ExtraInfo, scalar.Staffs)
	}

	err = store.UpdateScalar(ctx, other, game.ScalarChanges{BID: patch.Clearable[string]{Set: true, Value: new("300")}, VID: patch.Clearable[string]{Set: true, Value: new("v100")}})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.UpdateScalar(ctx, id, game.ScalarChanges{BID: patch.Clearable[string]{Set: true, Value: new("300")}}); !errors.Is(err, game.ErrAlreadyExists) {
		t.Fatalf("duplicate (b_id, v_id): %v", err)
	}
	if err := store.UpdateScalar(ctx, 987654, game.ScalarChanges{TitleZH: &title}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	if err := store.SetStatus(ctx, 987654, game.StatusHidden); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game status: %v", err)
	}
	if _, err := store.Scalar(ctx, 987654); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing scalar: %v", err)
	}
}

func TestAdminDeleteCollectsStorageKeysAndCascades(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := gamepg.NewAdminStore(db.Ent)
	id := db.Game(t)
	kept := db.Game(t)
	uploader := db.User(t)
	resource := db.Ent.GameDownloadResource.Create().SetGameID(id).SetCreatorID(uploader).SaveX(ctx)
	file := db.Ent.GameDownloadResourceFile.Create().SetGameDownloadResourceID(resource.ID).SetCreatorID(uploader).SetType(1).SetFileName("a.7z").SetFileSize(1).SetFileHash("h").SetS3FileKey("games/a.7z").SaveX(ctx)
	db.Ent.GameDownloadResourceFile.Create().SetGameDownloadResourceID(resource.ID).SetCreatorID(uploader).SetType(1).SetFileName("local.7z").SetFileSize(1).SetFileHash("h").SaveX(ctx)
	db.Ent.GameDownloadResourceFileHistory.Create().SetFileID(file.ID).SetOperatorID(uploader).SetFileSize(1).SetHashAlgorithm("blake3").SetFileHash("old").SetS3FileKey("games/old.7z").SaveX(ctx)
	db.Ent.GameDownloadResourceFileHistory.Create().SetFileID(file.ID).SetOperatorID(uploader).SetFileSize(1).SetHashAlgorithm("blake3").SetFileHash("same").SetS3FileKey("games/a.7z").SaveX(ctx)
	otherResource := db.Ent.GameDownloadResource.Create().SetGameID(kept).SetCreatorID(uploader).SaveX(ctx)
	db.Ent.GameDownloadResourceFile.Create().SetGameDownloadResourceID(otherResource.ID).SetCreatorID(uploader).SetType(1).SetFileName("b.7z").SetFileSize(1).SetFileHash("h").SetS3FileKey("games/b.7z").SaveX(ctx)

	err := postgres.NewTransactor(db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		if err := store.Lock(ctx, id); err != nil {
			return err
		}
		keys, err := store.StorageKeys(ctx, id)
		if err != nil {
			return err
		}
		if !slices.Equal(keys, []string{"games/a.7z", "games/old.7z"}) {
			t.Fatalf("keys: %v", keys)
		}
		return store.Delete(ctx, id)
	})
	if err != nil {
		t.Fatal(err)
	}
	if exists := db.Ent.GameDownloadResource.Query().ExistX(ctx); !exists {
		t.Fatal("other games keep their resources")
	}
	if count := db.Ent.GameDownloadResourceFile.Query().CountX(ctx); count != 1 {
		t.Fatalf("files cascade with the game: %d", count)
	}
	if err := store.Lock(ctx, id); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("lock after delete: %v", err)
	}
	if err := store.Delete(ctx, id); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("delete twice: %v", err)
	}
}
