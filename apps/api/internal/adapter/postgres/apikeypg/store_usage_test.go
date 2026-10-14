package apikeypg_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/apikeypg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

func day(d int) time.Time {
	return time.Date(2026, 10, d, 0, 0, 0, 0, time.UTC)
}

func TestUsageIsSavedOncePerKeyAndDayAndSummed(t *testing.T) {
	db := pgtest.New(t)
	ctx := t.Context()
	repo, store := apikeypg.NewRepository(db.Ent), apikeypg.NewUsageStore(db.Ent)
	owner, other := db.User(t), db.User(t)
	busy, err := repo.Create(ctx, apikey.NewKey{UserID: owner, Name: "busy sync", Prefix: "shl_busy0000", SecretHash: "h-busy"})
	if err != nil {
		t.Fatal(err)
	}
	quiet, err := repo.Create(ctx, apikey.NewKey{UserID: other, Name: "quiet", Prefix: "shl_quiet000", SecretHash: "h-quiet"})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveCounts(ctx, []apikey.Count{{KeyID: busy.ID, Day: day(13), Requests: 5, Throttled: 1}, {KeyID: 987654, Day: day(13), Requests: 9}}); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveCounts(ctx, []apikey.Count{{KeyID: busy.ID, Day: day(13), Requests: 7, Throttled: 2}, {KeyID: busy.ID, Day: day(14), Requests: 3}, {KeyID: quiet.ID, Day: day(1), Requests: 1}}); err != nil {
		t.Fatal(err)
	}
	summary, err := store.Summary(ctx, day(14), day(8))
	if err != nil || summary.Today != 3 || summary.Throttled != 2 || summary.Used != 1 || summary.Total != 2 {
		t.Fatalf("totals are replaced, not added, and old days are left out: %+v %v", summary, err)
	}
	days, err := store.Days(ctx, day(8), nil)
	if err != nil || len(days) != 2 || days[0].Requests != 7 || days[1].Requests != 3 || !days[1].Day.Equal(day(14)) {
		t.Fatalf("days: %+v %v", days, err)
	}
	listed, total, err := store.List(ctx, apikey.Filter{Since: day(8), Sort: apikey.SortRequests}, paging.Page{Number: 1, Size: 10})
	if err != nil || total != 2 || listed[0].ID != busy.ID || listed[0].Recent.Requests != 10 || listed[0].Recent.Throttled != 2 || listed[0].Owner.ID != owner {
		t.Fatalf("the busiest key first: %+v %d %v", listed, total, err)
	}
	found, total, err := store.List(ctx, apikey.Filter{Since: day(8), Query: "SYNC"}, paging.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || found[0].ID != busy.ID {
		t.Fatalf("found by its name: %+v %v", found, err)
	}
	byPrefix, _, err := store.List(ctx, apikey.Filter{Since: day(8), Query: "shl_quiet"}, paging.Page{Number: 1, Size: 10})
	if err != nil || len(byPrefix) != 1 || byPrefix[0].ID != quiet.ID {
		t.Fatalf("found by its prefix: %+v %v", byPrefix, err)
	}
	suspended := apikey.StatusSuspended
	if none, total, err := store.List(ctx, apikey.Filter{Since: day(8), Status: &suspended}, paging.Page{Number: 1, Size: 10}); err != nil || total != 0 || len(none) != 0 {
		t.Fatalf("no suspended key: %+v %v", none, err)
	}
	detail, err := store.Detail(ctx, busy.ID, day(1))
	if err != nil || detail.Total.Requests != 10 || len(detail.Days) != 2 || detail.Owner.ID != owner || len(detail.Others) != 0 {
		t.Fatalf("detail: %+v %v", detail, err)
	}
	if err := store.PruneBefore(ctx, day(14)); err != nil {
		t.Fatal(err)
	}
	if days, err := store.Days(ctx, day(1), nil); err != nil || len(days) != 1 {
		t.Fatalf("older days are pruned: %+v %v", days, err)
	}
}
