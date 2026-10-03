package adminpg_test

import (
	"context"
	"encoding/json"
	"maps"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/adminpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
)

func TestOverviewAndDailyCreations(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewStatsStore(db.Ent)
	today := time.Date(2026, 2, 17, 16, 0, 0, 0, time.UTC)

	early := db.Game(t, func(c *ent.GameCreate) {
		c.SetCreated(today.Add(-time.Hour)).SetViews(10).SetDownloads(4)
	})
	db.Game(t, func(c *ent.GameCreate) { c.SetCreated(today.Add(time.Hour)).SetViews(5).SetDownloads(1) })
	db.Game(t, func(c *ent.GameCreate) { c.SetCreated(today.Add(2 * time.Hour)).SetStatus(2).SetViews(100) })
	if _, err := db.SQL.ExecContext(ctx, `UPDATE users SET created = $1`, today.Add(-48*time.Hour)); err != nil {
		t.Fatal(err)
	}
	db.Ent.User.Create().SetName("fresh").SetEmail("fresh@example.test").SetContentLimit(1).SetCreated(today.Add(30 * time.Minute)).SaveX(ctx)
	db.Ent.User.Create().SetName("banned").SetEmail("banned@example.test").SetContentLimit(1).SetStatus(2).SetCreated(today.Add(time.Hour)).SaveX(ctx)
	db.Ent.GameCharacter.Create().SaveX(ctx)
	db.Ent.GameDeveloper.Create().SaveX(ctx)
	db.Ent.Comment.Create().SetContent(json.RawMessage(`{}`)).SetGameID(early).SetCreatorID(db.Ent.Game.GetX(ctx, early).CreatorID).SetStatus(3).SaveX(ctx)

	overview, err := store.Overview(ctx, today)
	if err != nil {
		t.Fatal(err)
	}
	want := admin.Overview{TotalGames: 2, TotalUsers: 4, TotalDownloads: 5, TotalViews: 15, TotalCharacters: 1, TotalDevelopers: 1, TotalComments: 1, NewGamesToday: 1, NewUsersToday: 1}
	if overview != want {
		t.Fatalf("overview\n got %+v\nwant %+v", overview, want)
	}

	daily, err := store.DailyCreations(ctx, today.Add(-24*time.Hour), 8*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if !maps.Equal(daily.Games, map[string]int{"2026-02-17": 1, "2026-02-18": 1}) {
		t.Fatalf("games bucketed by UTC+8 day: %v", daily.Games)
	}
	if !maps.Equal(daily.Users, map[string]int{"2026-02-18": 1}) {
		t.Fatalf("active users only: %v", daily.Users)
	}
}
