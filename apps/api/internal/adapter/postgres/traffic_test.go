package postgres_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
)

func TestDailyCountersAddUpPerDayInUTC8(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	evening := time.Date(2026, 2, 17, 15, 30, 0, 0, time.UTC)
	afterMidnight := time.Date(2026, 2, 17, 16, 5, 0, 0, time.UTC)
	for _, at := range []time.Time{evening, evening, afterMidnight} {
		if err := postgres.CountDailyView(ctx, db.Ent, at); err != nil {
			t.Fatal(err)
		}
	}
	if err := postgres.CountDailyDownload(ctx, db.Ent, evening); err != nil {
		t.Fatal(err)
	}

	rows, err := db.SQL.QueryContext(ctx, `SELECT to_char(day, 'YYYY-MM-DD'), views, downloads FROM site_daily_stats ORDER BY day`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	type line struct {
		day              string
		views, downloads int
	}
	var got []line
	for rows.Next() {
		var l line
		if err := rows.Scan(&l.day, &l.views, &l.downloads); err != nil {
			t.Fatal(err)
		}
		got = append(got, l)
	}
	want := []line{{"2026-02-17", 2, 1}, {"2026-02-18", 1, 0}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("daily counters\n got %+v\nwant %+v", got, want)
	}
}
