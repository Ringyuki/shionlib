package adminpg_test

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/adminpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
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

	uploader := db.Ent.Game.GetX(ctx, early).CreatorID
	published := func(at time.Time, status int) {
		db.Ent.GameDownloadResource.Create().SetGameID(early).SetCreatorID(uploader).SetStatus(status).SetPublishedAt(at).SaveX(ctx)
	}
	published(today.Add(-time.Hour), 1)
	published(today.Add(time.Hour), 1)
	published(today.Add(time.Hour), 2)
	db.Ent.GameDownloadResource.Create().SetGameID(early).SetCreatorID(uploader).SaveX(ctx)
	db.Ent.Comment.Create().SetContent(json.RawMessage(`{}`)).SetGameID(early).SetCreatorID(uploader).SetCreated(today.Add(-time.Minute)).SaveX(ctx)
	for _, at := range []time.Time{today.Add(-time.Minute), today, today.Add(time.Hour)} {
		if err := postgres.CountDailyView(ctx, db.Ent, at); err != nil {
			t.Fatal(err)
		}
	}
	if err := postgres.CountDailyDownload(ctx, db.Ent, today.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}

	overview, err := store.Overview(ctx, today)
	if err != nil {
		t.Fatal(err)
	}
	want := admin.Overview{TotalGames: 2, TotalUsers: 4, TotalDownloads: 5, TotalViews: 15, TotalCharacters: 1, TotalDevelopers: 1, TotalComments: 2, TotalResources: 2, NewGamesToday: 1, NewUsersToday: 1, NewResourcesToday: 1, NewCommentsToday: 1, DownloadsToday: 1, ViewsToday: 2}
	if overview != want {
		t.Fatalf("overview\n got %+v\nwant %+v", overview, want)
	}

	daily, err := store.Daily(ctx, today.Add(-24*time.Hour), 8*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if !maps.Equal(daily.Games, map[string]int{"2026-02-17": 1, "2026-02-18": 1}) {
		t.Fatalf("games bucketed by UTC+8 day: %v", daily.Games)
	}
	if !maps.Equal(daily.Users, map[string]int{"2026-02-18": 1}) {
		t.Fatalf("active users only: %v", daily.Users)
	}
	if !maps.Equal(daily.Views, map[string]int{"2026-02-17": 1, "2026-02-18": 2}) || !maps.Equal(daily.Downloads, map[string]int{"2026-02-17": 0, "2026-02-18": 1}) {
		t.Fatalf("views and downloads by day: %v %v", daily.Views, daily.Downloads)
	}
}

func TestPendingAndFileCounts(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewStatsStore(db.Ent)
	now := time.Date(2026, 2, 17, 16, 0, 0, 0, time.UTC)
	gameID := db.Game(t)
	uploader := db.Ent.Game.GetX(ctx, gameID).CreatorID
	active := db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(uploader).SaveX(ctx)
	removed := db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(uploader).SetStatus(2).SaveX(ctx)
	file := func(resource, status, check int, size int64) {
		db.Ent.GameDownloadResourceFile.Create().
			SetGameDownloadResourceID(resource).SetCreatorID(uploader).SetType(1).
			SetFileName(fmt.Sprintf("f-%d-%d-%d-%d.7z", resource, status, check, size)).SetFileSize(size).SetFileHash("h").
			SetFileStatus(status).SetFileCheckStatus(check).SaveX(ctx)
	}
	file(active.ID, 2, 0, 10)
	file(active.ID, 2, 1, 20)
	file(active.ID, 2, 1, 21)
	file(active.ID, 2, 8, 30)
	file(active.ID, 3, 1, 400)
	file(active.ID, 3, 1, 500)
	file(removed.ID, 3, 1, 9000)
	file(removed.ID, 2, 0, 9001)
	session := func(status string, size int64, expires time.Time) {
		db.Ent.GameUploadSession.Create().
			SetFileName("u.7z").SetTotalSize(size).SetChunkSize(1).SetTotalChunks(1).SetFileSha256("s").
			SetStatus(gameuploadsession.Status(status)).SetStoragePath(fmt.Sprintf("/spool/%s-%d", status, size)).
			SetExpiresAt(expires).SetCreatorID(uploader).SaveX(ctx)
	}
	session("UPLOADING", 100, now.Add(time.Hour))
	session("UPLOADING", 250, now.Add(time.Hour))
	session("UPLOADING", 7000, now.Add(-time.Hour))
	session("COMPLETED", 8000, now.Add(time.Hour))

	counts, err := store.FileCounts(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	wantCounts := admin.FileCounts{Uploading: admin.Tally{Files: 2, Bytes: 350}, AwaitingCheck: 1, AwaitingStore: 2, Stored: admin.Tally{Files: 2, Bytes: 900}}
	if counts != wantCounts {
		t.Fatalf("file counts\n got %+v\nwant %+v", counts, wantCounts)
	}

	reporter := db.User(t)
	db.Ent.GameDownloadResourceReport.Create().SetResourceID(active.ID).SetReporterID(reporter).SetReportedUserID(uploader).SetReason("OTHER").SetMaliciousLevel("MEDIUM").SaveX(ctx)
	db.Ent.GameDownloadResourceReport.Create().SetResourceID(active.ID).SetReporterID(reporter).SetReportedUserID(uploader).SetReason("OTHER").SetMaliciousLevel("MEDIUM").SetStatus("INVALID").SaveX(ctx)
	db.Ent.MalwareScanCase.Create().SetUploaderID(uploader).SetReviewDeadline(now).SetDetector("clamscan").SetFileName("m.7z").SetFileSize(1).SetFileHash("h").SaveX(ctx)
	db.Ent.Comment.Create().SetContent(json.RawMessage(`{}`)).SetGameID(gameID).SetCreatorID(uploader).SetStatus(2).SaveX(ctx)
	db.Ent.Comment.Create().SetContent(json.RawMessage(`{}`)).SetGameID(gameID).SetCreatorID(uploader).SetStatus(2).SaveX(ctx)
	db.Ent.Comment.Create().SetContent(json.RawMessage(`{}`)).SetGameID(gameID).SetCreatorID(uploader).SetStatus(3).SaveX(ctx)
	db.Ent.Walkthrough.Create().SetGameID(gameID).SetCreatorID(uploader).SetReviewPending(true).SaveX(ctx)
	db.Ent.Walkthrough.Create().SetGameID(gameID).SetCreatorID(reporter).SaveX(ctx)

	pending, err := store.Pending(ctx)
	if err != nil {
		t.Fatal(err)
	}
	wantPending := admin.Pending{Reports: 1, MalwareCases: 1, StalledFiles: 1, Comments: 2, Walkthroughs: 1}
	if pending != wantPending {
		t.Fatalf("pending\n got %+v\nwant %+v", pending, wantPending)
	}
}
