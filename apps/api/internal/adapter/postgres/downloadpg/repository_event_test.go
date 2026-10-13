package downloadpg_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/commentpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

var _ download.Discussions = (*commentpg.Repository)(nil)

func TestGetGameResourceLoadsFilesAndHidesRatedGames(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	safe, rated := f.db.Game(t), f.db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	open := f.resource(t, safe, creator)
	f.file(t, open.ID, creator, "a.7z")
	f.file(t, open.ID, creator, "b.7z")
	adult := f.resource(t, rated, creator)
	f.file(t, adult.ID, creator, "c.7z")

	got, err := f.repo.GetGameResource(ctx, open.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != open.ID || got.Creator.ID != creator || len(got.Files) != 2 || got.Files[0].Name != "a.7z" || got.Files[1].GameID != safe {
		t.Fatalf("resource with its files in order: %+v", got)
	}
	if _, err := f.repo.GetGameResource(ctx, adult.ID, true); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("a strict viewer does not find the resource of a rated game: %v", err)
	}
	if _, err := f.repo.GetGameResource(ctx, adult.ID, false); err != nil {
		t.Fatalf("other viewers do: %v", err)
	}
	if _, err := f.repo.GetGameResource(ctx, adult.ID+1000, false); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("missing resource: %v", err)
	}
}

func TestEventsKeepTheirDataAndComeNewestFirst(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator, admin := f.db.User(t), f.db.User(t)
	resource := f.resource(t, f.db.Game(t), creator)
	other := f.resource(t, f.db.Game(t), creator)
	oldSize, newSize := int64(100), int64(120)
	inputs := []download.NewEvent{
		{ResourceID: resource.ID, Kind: download.EventPublished, ActorID: &creator, Data: download.EventData{Files: []download.EventFile{{Name: "game.7z", Size: 100}}}},
		{ResourceID: resource.ID, Kind: download.EventFileRenamed, ActorID: &creator, Data: download.EventData{Name: "本体.7z", OldName: "game.7z"}},
		{ResourceID: resource.ID, Kind: download.EventEdited, ActorID: &creator, Data: download.EventData{Changes: []download.FieldChange{{Field: download.FieldSimulator, Old: []string{"ONS"}, New: nil}}}},
		{ResourceID: resource.ID, Kind: download.EventFileReplaced, ActorID: &admin, Data: download.EventData{Name: "本体.7z", Reason: ptr("更新crack"), OldSize: &oldSize, NewSize: &newSize}},
		{ResourceID: resource.ID, Kind: download.EventReviewCleared, Data: download.EventData{Name: "本体.7z"}},
		{ResourceID: other.ID, Kind: download.EventPublished, ActorID: &creator},
	}
	for _, in := range inputs {
		if err := f.repo.CreateEvent(ctx, in); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.repo.CreateEvent(ctx, download.NewEvent{ResourceID: resource.ID + 1000, Kind: download.EventPublished}); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("an event of a missing resource: %v", err)
	}

	events, err := f.repo.ListEvents(ctx, resource.ID, 10)
	if err != nil {
		t.Fatal(err)
	}
	kinds := make([]download.EventKind, len(events))
	for i, event := range events {
		kinds[i] = event.Kind
	}
	want := []download.EventKind{download.EventReviewCleared, download.EventFileReplaced, download.EventEdited, download.EventFileRenamed, download.EventPublished}
	if !slices.Equal(kinds, want) {
		t.Fatalf("newest first and only this resource's: %v", kinds)
	}
	if cleared := events[0]; cleared.Actor != nil || cleared.Data.Name != "本体.7z" {
		t.Fatalf("an event without an actor: %+v", cleared)
	}
	if replaced := events[1]; replaced.Actor.ID != admin || *replaced.Data.Reason != "更新crack" || *replaced.Data.OldSize != 100 || *replaced.Data.NewSize != 120 {
		t.Fatalf("replaced: %+v", replaced)
	}
	if edited := events[2].Data.Changes; len(edited) != 1 || edited[0].Field != download.FieldSimulator || !slices.Equal(edited[0].Old, []string{"ONS"}) || edited[0].New == nil || len(edited[0].New) != 0 {
		t.Fatalf("a cleared field comes back as an empty list: %+v", edited)
	}
	if renamed := events[3].Data; renamed.Name != "本体.7z" || renamed.OldName != "game.7z" {
		t.Fatalf("renamed: %+v", renamed)
	}
	if published := events[4]; published.Actor.ID != creator || len(published.Data.Files) != 1 || published.Data.Files[0] != (download.EventFile{Name: "game.7z", Size: 100}) {
		t.Fatalf("published: %+v", published)
	}
	if limited, _ := f.repo.ListEvents(ctx, resource.ID, 2); len(limited) != 2 {
		t.Fatalf("the list is bounded: %d", len(limited))
	}

	if err := f.repo.DeleteResource(ctx, resource.ID); err != nil {
		t.Fatal(err)
	}
	if left, _ := f.repo.ListEvents(ctx, resource.ID, 10); len(left) != 0 {
		t.Fatalf("events go with their resource: %+v", left)
	}
}

func TestCommentCountsPerResource(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	gameID := f.db.Game(t)
	first, second, silent := f.resource(t, gameID, creator), f.resource(t, gameID, creator), f.resource(t, gameID, creator)
	comments := commentpg.NewRepository(f.db.Ent)
	add := func(resourceID *int, status comment.Status) {
		created, err := comments.Create(ctx, comment.NewComment{Content: []byte(`{"type":"doc"}`), Text: "c", GameID: gameID, ResourceID: resourceID, CreatorID: creator})
		if err != nil {
			t.Fatal(err)
		}
		if err := comments.SetStatus(ctx, created.ID, status); err != nil {
			t.Fatal(err)
		}
	}
	add(&first.ID, comment.StatusVisible)
	add(&first.ID, comment.StatusVisible)
	add(&first.ID, comment.StatusPending)
	add(&second.ID, comment.StatusVisible)
	add(&second.ID, comment.StatusBlocked)
	add(nil, comment.StatusVisible)

	counts, err := comments.CountByResource(ctx, []int{first.ID, second.ID, silent.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(counts) != 2 || counts[first.ID] != 2 || counts[second.ID] != 1 {
		t.Fatalf("only visible comments of each resource are counted: %v", counts)
	}
	if none, err := comments.CountByResource(ctx, nil); err != nil || len(none) != 0 {
		t.Fatalf("no resources, no query: %v %v", none, err)
	}
}
