package indexingpg_test

import (
	"context"
	"testing"
	"time"

	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/indexingpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
)

func TestFeedListsWhatChangedInOrder(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	since := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	game := db.Game(t)
	creator := db.User(t)
	published := db.Ent.GameDownloadResource.Create().SetGameID(game).SetCreatorID(creator).SetPublishedAt(since.Add(time.Hour)).SaveX(ctx).ID
	older := db.Ent.GameDownloadResource.Create().SetGameID(game).SetCreatorID(creator).SetPublishedAt(since.Add(-time.Hour)).SaveX(ctx).ID
	db.Ent.GameDownloadResourceEvent.Create().SetResourceID(older).SetKind("deleted").SetCreated(since.Add(2 * time.Hour)).ExecX(ctx)
	db.Ent.GameDownloadResource.Create().SetGameID(game).SetCreatorID(creator).ExecX(ctx)
	guide := db.Ent.Walkthrough.Create().SetGameID(game).SetCreatorID(creator).SetText("guide").SetStatus(entwalkthrough.StatusPUBLISHED).SetUpdated(since.Add(3 * time.Hour)).SaveX(ctx).ID
	db.Ent.Walkthrough.Create().SetGameID(game).SetCreatorID(db.User(t)).SetText("draft").SetStatus(entwalkthrough.StatusDRAFT).SetUpdated(since.Add(4 * time.Hour)).ExecX(ctx)

	changes, err := indexingpg.NewChangeStore(db.Ent).Changes(ctx, since, 10)
	if err != nil {
		t.Fatal(err)
	}
	want := []indexing.Change{
		{Kind: indexing.ChangeResource, ID: published, GameID: game, At: since.Add(time.Hour)},
		{Kind: indexing.ChangeResource, ID: older, GameID: game, At: since.Add(2 * time.Hour)},
		{Kind: indexing.ChangeWalkthrough, ID: guide, GameID: game, At: since.Add(3 * time.Hour)},
	}
	if len(changes) != len(want) {
		t.Fatalf("unexpected changes %+v", changes)
	}
	for i := range want {
		if changes[i].Kind != want[i].Kind || changes[i].ID != want[i].ID || changes[i].GameID != want[i].GameID || !changes[i].At.Equal(want[i].At) {
			t.Fatalf("change %d: %+v, want %+v", i, changes[i], want[i])
		}
	}
	if limited, _ := indexingpg.NewChangeStore(db.Ent).Changes(ctx, since, 1); len(limited) != 1 {
		t.Fatalf("the limit holds: %+v", limited)
	}
}
