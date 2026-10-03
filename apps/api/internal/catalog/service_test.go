package catalog_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var now = time.Date(2026, 10, 3, 9, 0, 0, 0, time.UTC)

type fixture struct {
	source  *catalogtest.Source
	store   *catalogtest.Store
	queue   *catalogtest.Queue
	tx      *txtest.Immediate
	service *catalog.Service
}

func setup() fixture {
	f := fixture{
		source: catalogtest.NewSource(catalog.SourceHikarinagi),
		store:  catalogtest.NewStore(),
		queue:  &catalogtest.Queue{},
		tx:     &txtest.Immediate{},
	}
	f.service = catalog.NewService([]catalog.Source{f.source}, f.store, f.tx, f.queue, func() time.Time { return now }, catalog.Options{
		CreatorID:    1,
		RefreshAfter: 24 * time.Hour,
		RefreshBatch: 2,
		ChangesBatch: 10,
	})
	return f
}

func ref(entity catalog.Entity, id string) catalog.Ref {
	return catalog.Ref{Source: catalog.SourceHikarinagi, Entity: entity, ExternalID: id}
}

func gameSnapshot(id string) catalog.GameSnapshot {
	return catalog.GameSnapshot{
		ExternalID: id,
		Title:      catalog.Localized{Origin: "タイトル", OriginLang: "ja"},
		Developers: []catalog.DeveloperCredit{{ExternalID: "5", Name: "枕", Role: "DEVELOPER"}, {ExternalID: "6", Name: "发行商", Role: "PUBLISHER"}},
		Characters: []catalog.CharacterCredit{{ExternalID: "9", Name: "稟", Role: "MAIN"}},
	}
}

func TestImportAppliesInsideATransactionAndQueuesUnsyncedCredits(t *testing.T) {
	f := setup()
	f.source.Games["77"] = gameSnapshot("77")
	id, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77"))
	if err != nil {
		t.Fatal(err)
	}
	if f.tx.Calls != 1 {
		t.Fatalf("apply must run in one transaction, got %d", f.tx.Calls)
	}
	record := f.store.Games[id]
	if record.TitleJP != "タイトル" || len(record.Developers) != 1 || record.Developers[0].ExternalID != "5" {
		t.Fatalf("stored record %+v", record)
	}
	want := []catalog.Ref{ref(catalog.EntityDeveloper, "5"), ref(catalog.EntityCharacter, "9")}
	if !slices.Equal(f.queue.Refs(), want) {
		t.Fatalf("queued %v, want %v", f.queue.Refs(), want)
	}
	link, _ := f.store.Link(ref(catalog.EntityGame, "77"))
	if link.SyncedAt == nil || !link.SyncedAt.Equal(now) {
		t.Fatalf("link not synced %+v", link)
	}
}

func TestImportDeveloperAndCharacter(t *testing.T) {
	f := setup()
	f.source.Developers["5"] = catalog.DeveloperSnapshot{ExternalID: "5", Name: "枕", Website: new("https://makura.test")}
	f.source.Characters["9"] = catalog.CharacterSnapshot{ExternalID: "9", Name: catalog.Localized{Origin: "御桜稟"}, Gender: []string{"女"}, BloodType: new("A型")}
	developerID, err := f.service.Import(context.Background(), ref(catalog.EntityDeveloper, "5"))
	if err != nil {
		t.Fatal(err)
	}
	if developer := f.store.Developers[developerID]; developer.Name != "枕" || *developer.Website != "https://makura.test" {
		t.Fatalf("developer %+v", developer)
	}
	characterID, err := f.service.Import(context.Background(), ref(catalog.EntityCharacter, "9"))
	if err != nil {
		t.Fatal(err)
	}
	if character := f.store.Characters[characterID]; character.NameJP != "御桜稟" || !slices.Equal(character.Gender, []string{"f"}) || *character.BloodType != "a" {
		t.Fatalf("character %+v", character)
	}
	if len(f.queue.Jobs) != 0 {
		t.Fatalf("developer and character imports queue nothing: %v", f.queue.Jobs)
	}
}

func TestImportOfAnEntryGoneAtTheSourceHidesTheGame(t *testing.T) {
	f := setup()
	id := f.store.Seed(ref(catalog.EntityGame, "77"), &now)
	_, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77"))
	if !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("expected ErrEntryNotFound, got %v", err)
	}
	if !f.store.Hidden[id] {
		t.Fatal("game must be hidden")
	}
	link, _ := f.store.Link(ref(catalog.EntityGame, "77"))
	if link.MissingAt == nil || link.Failures != 0 {
		t.Fatalf("link %+v", link)
	}
	developer := f.store.Seed(ref(catalog.EntityDeveloper, "5"), &now)
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityDeveloper, "5")); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("developer: %v", err)
	}
	if f.store.Hidden[developer] {
		t.Fatal("only games are hidden")
	}
}

func TestImportFailuresAreRecordedExceptRateLimits(t *testing.T) {
	f := setup()
	f.store.Seed(ref(catalog.EntityGame, "77"), nil)
	f.source.Err = errors.New("upstream exploded")
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77")); err == nil {
		t.Fatal("expected an error")
	}
	link, _ := f.store.Link(ref(catalog.EntityGame, "77"))
	if link.Failures != 1 || link.LastError != "upstream exploded" {
		t.Fatalf("failure not recorded %+v", link)
	}

	f.source.Err = catalog.ErrRateLimited
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77")); !errors.Is(err, catalog.ErrRateLimited) {
		t.Fatalf("expected rate limit, got %v", err)
	}
	if link, _ := f.store.Link(ref(catalog.EntityGame, "77")); link.Failures != 1 {
		t.Fatalf("rate limits are not failures %+v", link)
	}

	f.source.Err = nil
	f.source.Games["77"] = gameSnapshot("77")
	f.store.ApplyErr = errors.New("constraint violated")
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77")); err == nil {
		t.Fatal("expected apply error")
	}
	if link, _ := f.store.Link(ref(catalog.EntityGame, "77")); link.Failures != 2 || link.LastError != "constraint violated" {
		t.Fatalf("apply failure not recorded %+v", link)
	}
	if len(f.queue.Jobs) != 0 {
		t.Fatalf("nothing is queued after a failed apply: %v", f.queue.Jobs)
	}
}

func TestUnknownSourcesAreRejected(t *testing.T) {
	f := setup()
	other := catalog.Ref{Source: "vndb", Entity: catalog.EntityGame, ExternalID: "1"}
	if _, err := f.service.Import(context.Background(), other); !errors.Is(err, catalog.ErrUnknownSource) {
		t.Fatalf("import: %v", err)
	}
	if err := f.service.Request(context.Background(), other); !errors.Is(err, catalog.ErrUnknownSource) {
		t.Fatalf("request: %v", err)
	}
	if _, err := f.service.Search(context.Background(), "vndb", "q", 1, 10); !errors.Is(err, catalog.ErrUnknownSource) {
		t.Fatalf("search: %v", err)
	}
}

func TestRequestQueuesValidRefsOnly(t *testing.T) {
	f := setup()
	if err := f.service.Request(context.Background(), ref(catalog.EntityGame, "77")); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Request(context.Background(), ref("tag", "1")); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("invalid entity: %v", err)
	}
	if err := f.service.Request(context.Background(), ref(catalog.EntityGame, "")); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("empty id: %v", err)
	}
	if !slices.Equal(f.queue.Refs(), []catalog.Ref{ref(catalog.EntityGame, "77")}) {
		t.Fatalf("queued %v", f.queue.Refs())
	}
}

func TestRefreshStaleQueuesABatchOfOldLinks(t *testing.T) {
	f := setup()
	old := now.Add(-48 * time.Hour)
	fresh := now.Add(-time.Hour)
	f.store.Seed(ref(catalog.EntityGame, "1"), &old)
	f.store.Seed(ref(catalog.EntityGame, "2"), &fresh)
	f.store.Seed(ref(catalog.EntityDeveloper, "3"), nil)
	f.store.Seed(ref(catalog.EntityCharacter, "4"), &old)
	if err := f.service.RefreshStale(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := []catalog.Ref{ref(catalog.EntityDeveloper, "3"), ref(catalog.EntityGame, "1")}
	if !slices.Equal(f.queue.Refs(), want) {
		t.Fatalf("queued %v, want %v", f.queue.Refs(), want)
	}
}

func TestPullChangesFollowsTheFeedAndPersistsTheCursor(t *testing.T) {
	f := setup()
	gone := f.store.Seed(ref(catalog.EntityGame, "30"), &now)
	f.store.Seed(ref(catalog.EntityDeveloper, "6"), &now)
	f.store.Seed(ref(catalog.EntityGame, "40"), &now)
	f.source.Feed[""] = catalog.ChangeBatch{
		Changes: []catalog.Change{
			{Entity: catalog.EntityGame, ExternalID: "10", Kind: catalog.ChangeUpsert},
			{Entity: catalog.EntityDeveloper, ExternalID: "5", Kind: catalog.ChangeUpsert},
			{Entity: catalog.EntityDeveloper, ExternalID: "6", Kind: catalog.ChangeUpsert},
		},
		Cursor:  "3",
		HasMore: true,
	}
	f.source.Feed["3"] = catalog.ChangeBatch{
		Changes: []catalog.Change{
			{Entity: catalog.EntityGame, ExternalID: "30", Kind: catalog.ChangeDelete},
			{Entity: catalog.EntityGame, ExternalID: "40", Kind: catalog.ChangeMerge, MergedInto: "41"},
		},
		Cursor: "5",
	}
	if err := f.service.PullChanges(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := []catalog.Ref{ref(catalog.EntityGame, "10"), ref(catalog.EntityDeveloper, "6"), ref(catalog.EntityGame, "41")}
	if !slices.Equal(f.queue.Refs(), want) {
		t.Fatalf("queued %v, want %v", f.queue.Refs(), want)
	}
	if cursor, _ := f.store.Cursor(context.Background(), catalog.SourceHikarinagi); cursor != "5" {
		t.Fatalf("cursor %q", cursor)
	}
	if !f.store.Hidden[gone] {
		t.Fatal("deleted game must be hidden")
	}
	merged, _ := f.store.Link(ref(catalog.EntityGame, "40"))
	if merged.MissingAt == nil {
		t.Fatal("merged entry must be marked missing")
	}
	if !slices.Equal(f.source.Requests, []string{"changes:", "changes:3"}) {
		t.Fatalf("requests %v", f.source.Requests)
	}
}

func TestPullChangesStopsWhenTheCursorDoesNotMove(t *testing.T) {
	f := setup()
	f.source.Feed[""] = catalog.ChangeBatch{Cursor: "", HasMore: true}
	if err := f.service.PullChanges(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(f.source.Requests) != 1 {
		t.Fatalf("expected a single request, got %v", f.source.Requests)
	}
}

func TestPullChangesStopsAtTheFirstError(t *testing.T) {
	f := setup()
	f.source.Feed[""] = catalog.ChangeBatch{Changes: []catalog.Change{{Entity: catalog.EntityGame, ExternalID: "1", Kind: catalog.ChangeUpsert}}, Cursor: "1", HasMore: true}
	f.queue.Err = errors.New("queue down")
	if err := f.service.PullChanges(context.Background()); err == nil {
		t.Fatal("expected an error")
	}
	if cursor, _ := f.store.Cursor(context.Background(), catalog.SourceHikarinagi); cursor != "" {
		t.Fatalf("cursor must not advance past an unapplied change: %q", cursor)
	}
}

func TestSearchWrapsSourceFailures(t *testing.T) {
	f := setup()
	f.source.Hits = []catalog.SearchHit{{ExternalID: "1", Title: "a"}, {ExternalID: "2", Title: "b"}, {ExternalID: "3", Title: "c"}}
	result, err := f.service.Search(context.Background(), catalog.SourceHikarinagi, "a", 2, 2)
	if err != nil || result.Total != 3 || len(result.Hits) != 1 || result.Hits[0].ExternalID != "3" {
		t.Fatalf("search %+v %v", result, err)
	}
	f.source.Err = errors.New("timeout")
	if _, err := f.service.Search(context.Background(), catalog.SourceHikarinagi, "a", 1, 2); !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("expected source unavailable, got %v", err)
	}
	if !slices.Equal(f.service.Sources(), []string{catalog.SourceHikarinagi}) {
		t.Fatalf("sources %v", f.service.Sources())
	}
}

func TestExcludedEntriesAreOnlyImportedOnRequest(t *testing.T) {
	f := setup()
	f.source.Games["77"] = gameSnapshot("77")
	id, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77"))
	if err != nil {
		t.Fatal(err)
	}
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, id); err != nil {
		t.Fatal(err)
	}
	requests := len(f.source.Requests)
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77")); !errors.Is(err, catalog.ErrExcluded) {
		t.Fatalf("background imports skip excluded entries: %v", err)
	}
	if len(f.source.Requests) != requests {
		t.Fatalf("excluded entries are not fetched: %v", f.source.Requests)
	}
	again, err := f.service.ImportNow(context.Background(), ref(catalog.EntityGame, "77"))
	if err != nil || again != id {
		t.Fatalf("explicit import %d %v", again, err)
	}
	if excluded, _ := f.store.Excluded(context.Background(), ref(catalog.EntityGame, "77")); excluded {
		t.Fatal("explicit import must include the entry again")
	}
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, id); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Request(context.Background(), ref(catalog.EntityGame, "77")); err != nil {
		t.Fatal(err)
	}
	if excluded, _ := f.store.Excluded(context.Background(), ref(catalog.EntityGame, "77")); excluded {
		t.Fatal("queued imports include the entry again")
	}
}
