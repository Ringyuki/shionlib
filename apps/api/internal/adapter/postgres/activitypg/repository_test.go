package activitypg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/activitypg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
)

func ptr[T any](v T) *T {
	return &v
}

func TestRecordAndFeedFiltering(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	repo := activitypg.NewRepository(db.Ent)
	user := db.User(t)
	safe := db.Game(t)
	nsfw := db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	ratedCover := db.Game(t)
	if err := db.Ent.GameCover.Create().SetGameID(ratedCover).SetLanguage("jp").SetURL("x").SetType("dig").SetSexual(2).SetViolence(0).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	developer := db.Ent.GameDeveloper.Create().SetName("Studio").SaveX(ctx)

	records := []activity.NewActivity{
		{Type: activity.TypeGameCreate, UserID: user, GameID: &safe},
		{Type: activity.TypeGameCreate, UserID: user, GameID: &nsfw},
		{Type: activity.TypeGameCreate, UserID: user, GameID: &ratedCover},
		{Type: activity.TypeDeveloperEdit, UserID: user, DeveloperID: &developer.ID},
		{Type: activity.TypeFileUploadToServer, UserID: user, GameID: &safe, FileName: ptr("fallback.bin"), FileSize: ptr(int64(123)), FileStatus: ptr(1), FileCheckStatus: ptr(0)},
	}
	for _, record := range records {
		if err := repo.Create(ctx, record); err != nil {
			t.Fatal(err)
		}
	}

	all, total, err := repo.List(ctx, activity.Filter{}, activity.Page{Number: 1, Size: 10})
	if err != nil || total != 5 || len(all) != 5 {
		t.Fatalf("permissive feed: total=%d len=%d err=%v", total, len(all), err)
	}
	if all[0].Type != activity.TypeFileUploadToServer || all[0].File == nil || all[0].File.ID != 0 || all[0].File.FileName != "fallback.bin" || all[0].File.FileSize != 123 || *all[0].File.FileStatus != 1 {
		t.Fatalf("file fallback mapping: %+v", all[0].File)
	}
	if all[1].Developer == nil || all[1].Developer.Name != "Studio" || all[1].GameID != nil || all[1].User.ID != user {
		t.Fatalf("developer reference: %+v", all[1])
	}

	strict, total, err := repo.List(ctx, activity.Filter{ExcludeRated: true}, activity.Page{Number: 1, Size: 10})
	if err != nil || total != 3 {
		t.Fatalf("strict feed must drop rated games but keep game-less entries: total=%d err=%v", total, err)
	}
	for _, entry := range strict {
		if entry.GameID != nil && (*entry.GameID == nsfw || *entry.GameID == ratedCover) {
			t.Fatalf("rated game leaked into strict feed: %+v", entry)
		}
	}

	edits, total, err := repo.List(ctx, activity.Filter{Types: activity.CategoryEdits.Types()}, activity.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || edits[0].Type != activity.TypeDeveloperEdit {
		t.Fatalf("category filter: %+v %d %v", edits, total, err)
	}
	paged, total, err := repo.List(ctx, activity.Filter{}, activity.Page{Number: 3, Size: 2})
	if err != nil || total != 5 || len(paged) != 1 {
		t.Fatalf("pagination: %d %d %v", len(paged), total, err)
	}
}
