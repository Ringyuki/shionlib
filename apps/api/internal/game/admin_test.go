package game_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

type adminFixture struct {
	store      *gametest.AdminStore
	recent     *gametest.RecentMarks
	exclusions *gametest.Exclusions
	purger     *gametest.Purger
	service    *game.AdminService
}

func newAdminFixture(games ...gametest.AdminGame) adminFixture {
	f := adminFixture{
		store:      gametest.NewAdminStore(games...),
		recent:     gametest.NewRecentMarks(),
		exclusions: &gametest.Exclusions{},
		purger:     &gametest.Purger{},
	}
	f.service = game.NewAdminService(f.store, f.recent, f.exclusions, f.purger, &txtest.Immediate{}, func() time.Time { return now })
	return f
}

func adminGame(id int, title string, status game.Status) gametest.AdminGame {
	return gametest.AdminGame{Entry: game.AdminEntry{ID: id, TitleJP: title, Status: status}}
}

func TestAdminSearchTrimsTheKeyword(t *testing.T) {
	f := newAdminFixture(adminGame(1, "Summer Pockets", game.StatusVisible), adminGame(2, "Winter", game.StatusHidden))
	entries, total, err := f.service.Search(context.Background(), game.AdminFilter{Search: "  pockets "}, game.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || entries[0].ID != 1 {
		t.Fatalf("search: %+v %d %v", entries, total, err)
	}
}

func TestAdminEditScalarNormalizesLegacyValues(t *testing.T) {
	f := newAdminFixture(adminGame(1, "a", game.StatusVisible))
	err := f.service.EditScalar(context.Background(), 1, game.ScalarChanges{
		BID:       game.Clearable[string]{Set: true, Value: ptr("")},
		VID:       game.Clearable[string]{Set: true, Value: ptr("  ")},
		Type:      game.Clearable[string]{Set: true, Value: ptr(" ")},
		ExtraInfo: game.Clearable[[]game.ExtraInfo]{Set: true},
		Staffs:    game.Clearable[[]game.Staff]{Set: true},
		TitleZH:   ptr("中文"),
	})
	if err != nil {
		t.Fatal(err)
	}
	stored, _ := f.store.Game(1)
	if stored.Scalar.BID != nil || stored.Scalar.VID != nil || stored.Scalar.Type != nil || stored.Scalar.TitleZH != "中文" {
		t.Fatalf("blank identifiers become null: %+v", stored.Scalar)
	}
	if string(stored.Scalar.ExtraInfo) != `[]` || string(stored.Scalar.Staffs) != `[]` {
		t.Fatalf("null arrays become []: %s %s", stored.Scalar.ExtraInfo, stored.Scalar.Staffs)
	}
	err = f.service.EditScalar(context.Background(), 1, game.ScalarChanges{BID: game.Clearable[string]{Set: true, Value: ptr(" 123 ")}})
	if stored, _ = f.store.Game(1); err != nil || stored.Scalar.BID == nil || *stored.Scalar.BID != " 123 " {
		t.Fatalf("non-blank identifiers are stored as sent: %v %+v", err, stored.Scalar.BID)
	}
}

func TestAdminEditScalarErrors(t *testing.T) {
	first := adminGame(1, "a", game.StatusVisible)
	first.Scalar.BID, first.Scalar.VID = ptr("1"), ptr("v1")
	f := newAdminFixture(first, adminGame(2, "b", game.StatusVisible))
	ctx := context.Background()
	if err := f.service.EditScalar(ctx, 99, game.ScalarChanges{}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing games are reported even without changes: %v", err)
	}
	if err := f.service.EditScalar(ctx, 2, game.ScalarChanges{}); err != nil {
		t.Fatalf("an empty edit is a no-op: %v", err)
	}
	conflict := game.ScalarChanges{BID: game.Clearable[string]{Set: true, Value: ptr("1")}, VID: game.Clearable[string]{Set: true, Value: ptr("v1")}}
	if err := f.service.EditScalar(ctx, 2, conflict); !errors.Is(err, game.ErrAlreadyExists) {
		t.Fatalf("duplicate external ids conflict: %v", err)
	}
}

func TestAdminDeleteExcludesFromCatalogAndPurgesObjects(t *testing.T) {
	doomed := adminGame(1, "a", game.StatusVisible)
	doomed.Keys = []string{"games/1/1/a.7z", "games/1/2/b.7z"}
	f := newAdminFixture(doomed, adminGame(2, "b", game.StatusVisible))
	ctx := context.Background()
	if err := f.service.MarkRecentlyUpdated(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Delete(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if _, ok := f.store.Game(1); ok {
		t.Fatal("game still stored")
	}
	if got := f.exclusions.Excluded(); !slices.Equal(got, []gametest.Exclusion{{Entity: catalog.EntityGame, ID: 1}}) {
		t.Fatalf("catalog exclusion: %+v", got)
	}
	if _, marked := f.recent.MarkedAt(1); marked {
		t.Fatal("deleted games leave the recent-update set")
	}
	if got := f.purger.Purged(); len(got) != 1 || !slices.Equal(got[0], doomed.Keys) {
		t.Fatalf("stored objects are purged: %v", got)
	}
	if err := f.service.Delete(ctx, 1); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("second delete: %v", err)
	}
	if len(f.exclusions.Excluded()) != 1 || len(f.purger.Purged()) != 1 {
		t.Fatal("a missing game changes nothing")
	}
}

func TestAdminStatusAndRecentUpdates(t *testing.T) {
	f := newAdminFixture(adminGame(1, "a", game.StatusVisible))
	ctx := context.Background()
	if err := f.service.SetStatus(ctx, 1, game.StatusHidden); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.store.Game(1); stored.Entry.Status != game.StatusHidden {
		t.Fatalf("status: %+v", stored.Entry)
	}
	if err := f.service.SetStatus(ctx, 9, game.StatusHidden); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	if err := f.service.MarkRecentlyUpdated(ctx, 42); err != nil {
		t.Fatal(err)
	}
	if at, ok := f.recent.MarkedAt(42); !ok || !at.Equal(now) {
		t.Fatalf("any id can be marked at the current time: %v %v", at, ok)
	}
	if err := f.service.UnmarkRecentlyUpdated(ctx, 42); err != nil {
		t.Fatal(err)
	}
	if _, ok := f.recent.MarkedAt(42); ok {
		t.Fatal("unmarked")
	}
	scalar, err := f.service.Scalar(ctx, 1)
	if err != nil || scalar.Status != game.StatusHidden {
		t.Fatalf("scalar: %+v %v", scalar, err)
	}
	if _, err := f.service.Scalar(ctx, 9); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing scalar: %v", err)
	}
}
