package catalog_test

import (
	"context"
	"errors"
	"maps"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
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
	f.service = catalog.NewService(catalog.Deps{
		Sources:  []catalog.Source{f.source},
		Store:    f.store,
		Tx:       f.tx,
		Queue:    f.queue,
		Now:      func() time.Time { return now },
		Settings: catalogSettings(),
		Options:  catalog.Options{CreatorID: 1},
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
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77")); !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("expected source unavailable, got %v", err)
	}
	link, _ := f.store.Link(ref(catalog.EntityGame, "77"))
	if link.Failures != 1 || link.LastError != "upstream exploded" {
		t.Fatalf("failure not recorded %+v", link)
	}

	f.source.Err = catalog.ErrRateLimited
	if _, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77")); !errors.Is(err, catalog.ErrRateLimited) || !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("expected a rate limit reported as the source being unavailable, got %v", err)
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
	if _, err := f.service.Search(context.Background(), "vndb", catalog.EntityGame, "q", 1, 10); !errors.Is(err, catalog.ErrUnknownSource) {
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
	f.source.Hits[catalog.EntityGame] = []catalog.SearchHit{{ExternalID: "1", Title: "a"}, {ExternalID: "2", Title: "b"}, {ExternalID: "3", Title: "c"}}
	f.source.Hits[catalog.EntityCharacter] = []catalog.SearchHit{{ExternalID: "9", Title: "稟"}}
	result, err := f.service.Search(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, "a", 2, 2)
	if err != nil || result.Total != 3 || len(result.Hits) != 1 || result.Hits[0].ExternalID != "3" {
		t.Fatalf("search %+v %v", result, err)
	}
	characters, err := f.service.Search(context.Background(), catalog.SourceHikarinagi, catalog.EntityCharacter, "稟", 1, 5)
	if err != nil || characters.Total != 1 || characters.Hits[0].ExternalID != "9" {
		t.Fatalf("searches are scoped to the entity: %+v %v", characters, err)
	}
	f.source.Err = errors.New("timeout")
	if _, err := f.service.Search(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, "a", 1, 2); !errors.Is(err, catalog.ErrSourceUnavailable) {
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
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, id, catalog.Exclusion{}); err != nil {
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
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, id, catalog.Exclusion{}); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Request(context.Background(), ref(catalog.EntityGame, "77")); err != nil {
		t.Fatal(err)
	}
	if excluded, _ := f.store.Excluded(context.Background(), ref(catalog.EntityGame, "77")); excluded {
		t.Fatal("queued imports include the entry again")
	}
}

func TestARequestedImportThatFailsLeavesTheEntryExcluded(t *testing.T) {
	f := setup()
	f.source.Games["77"] = gameSnapshot("77")
	id, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77"))
	if err != nil {
		t.Fatal(err)
	}
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, id, catalog.Exclusion{Title: "game 77", UserID: 4}); err != nil {
		t.Fatal(err)
	}
	f.source.Err = errors.New("timeout")
	if _, err := f.service.ImportNow(context.Background(), ref(catalog.EntityGame, "77")); !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("expected source unavailable, got %v", err)
	}
	entries, total, err := f.service.ExcludedEntries(context.Background(), 1, 10)
	if err != nil || total != 1 || entries[0].Title == nil || *entries[0].Title != "game 77" {
		t.Fatalf("the entry stays excluded as it was: %+v %d %v", entries, total, err)
	}
	f.source.Err = nil
	if _, err := f.service.ImportNow(context.Background(), ref(catalog.EntityGame, "77")); err != nil {
		t.Fatal(err)
	}
	if _, total, err := f.service.ExcludedEntries(context.Background(), 1, 10); err != nil || total != 0 {
		t.Fatalf("the entry is kept again: %d %v", total, err)
	}
}

func TestResolveMapsLinkedEntriesAndQueuesUnknownOnes(t *testing.T) {
	f := setup()
	f.source.Games["77"] = gameSnapshot("77")
	f.source.Games["78"] = gameSnapshot("78")
	first, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "77"))
	if err != nil {
		t.Fatal(err)
	}
	excluded, err := f.service.Import(context.Background(), ref(catalog.EntityGame, "78"))
	if err != nil {
		t.Fatal(err)
	}
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, excluded, catalog.Exclusion{}); err != nil {
		t.Fatal(err)
	}
	queued := len(f.queue.Refs())
	resolved, err := f.service.Resolve(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, []string{"79", "77", "78"})
	if err != nil || !maps.Equal(resolved, map[string]int{"77": first}) {
		t.Fatalf("resolved %v %v", resolved, err)
	}
	if refs := f.queue.Refs()[queued:]; !slices.Equal(refs, []catalog.Ref{ref(catalog.EntityGame, "79")}) {
		t.Fatalf("only unknown entries are queued for import: %v", refs)
	}
	if _, err := f.service.Resolve(context.Background(), "vndb", catalog.EntityGame, []string{"1"}); !errors.Is(err, catalog.ErrUnknownSource) {
		t.Fatalf("unknown source: %v", err)
	}
}

func catalogSettings() settingtest.Source {
	settings := settingtest.Source{}
	settingtest.Set(settings, catalog.RefreshInterval, 24*time.Hour)
	settingtest.Set(settings, catalog.RefreshBatch, 2)
	return settingtest.Set(settings, catalog.ChangesBatch, 10)
}

func TestSearchTellsWhichHitsAreAlreadyHere(t *testing.T) {
	f := setup()
	f.source.Hits[catalog.EntityGame] = []catalog.SearchHit{{ExternalID: "1", Title: "a"}, {ExternalID: "2", Title: "b"}, {ExternalID: "3", Title: "c"}}
	linked := f.store.Seed(ref(catalog.EntityGame, "1"), &now)
	removed := f.store.Seed(ref(catalog.EntityGame, "2"), &now)
	if err := f.service.Exclude(context.Background(), catalog.EntityGame, removed, catalog.Exclusion{}); err != nil {
		t.Fatal(err)
	}
	result, err := f.service.Search(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, "a", 1, 10)
	if err != nil || len(result.Hits) != 3 {
		t.Fatalf("search %+v %v", result, err)
	}
	here, gone, absent := result.Hits[0].Link, result.Hits[1].Link, result.Hits[2].Link
	if here == nil || here.LocalID != linked || here.Excluded {
		t.Fatalf("a linked hit names its local entry: %+v", here)
	}
	if gone == nil || !gone.Excluded {
		t.Fatalf("an excluded hit says so: %+v", gone)
	}
	if absent != nil {
		t.Fatalf("an unknown hit has no link: %+v", absent)
	}
	if f.source.Hits[catalog.EntityGame][0].Link != nil {
		t.Fatal("the hits of the source must not be changed")
	}
}

func TestFindOffersAnEntryByItsNumberWhenTheSearchDoesNotListIt(t *testing.T) {
	f := setup()
	f.source.Hits[catalog.EntityGame] = []catalog.SearchHit{{ExternalID: "1", Title: "a"}}
	linked := f.store.Seed(ref(catalog.EntityGame, "25085"), &now)
	found, err := f.service.Find(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, " 25085 ", 1, 10)
	if err != nil || len(found.Hits) != 2 || found.Total != 1 {
		t.Fatalf("find %+v %v", found, err)
	}
	numbered := found.Hits[0]
	if numbered.ExternalID != "25085" || numbered.Title != "" || numbered.Link == nil || numbered.Link.LocalID != linked {
		t.Fatalf("the number leads and says it is here: %+v", numbered)
	}
	unknown, err := f.service.Find(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, "404", 1, 10)
	if err != nil || len(unknown.Hits) != 2 || unknown.Hits[0].ExternalID != "404" || unknown.Hits[0].Link != nil {
		t.Fatalf("a number that is not here is offered without a link: %+v %v", unknown, err)
	}
	for _, query := range []string{"1", "a1", ""} {
		plain, err := f.service.Find(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, query, 1, 10)
		if err != nil || len(plain.Hits) != 1 {
			t.Fatalf("%q adds nothing to the hits: %+v %v", query, plain, err)
		}
	}
	if later, err := f.service.Find(context.Background(), catalog.SourceHikarinagi, catalog.EntityGame, "404", 2, 10); err != nil || len(later.Hits) != 0 {
		t.Fatalf("later pages are the hits alone: %+v %v", later, err)
	}
}

func TestSyncPullsOneSourceNowAndReportsItsState(t *testing.T) {
	f := setup()
	f.store.Seed(ref(catalog.EntityGame, "10"), &now)
	f.store.Seed(ref(catalog.EntityDeveloper, "5"), &now)
	f.source.Feed[""] = catalog.ChangeBatch{
		Changes: []catalog.Change{
			{Entity: catalog.EntityGame, ExternalID: "10", Kind: catalog.ChangeUpsert},
			{Entity: catalog.EntityGame, ExternalID: "11", Kind: catalog.ChangeUpsert},
		},
		Cursor: "7",
	}
	status, err := f.service.Sync(context.Background(), catalog.SourceHikarinagi)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Incremental || status.Counts != (catalog.LinkCounts{Games: 1, Developers: 1}) {
		t.Fatalf("status %+v", status)
	}
	if status.Sync.Cursor != "7" || status.Sync.Changes != 2 || status.Sync.PulledAt == nil || !status.Sync.PulledAt.Equal(now) || status.Sync.FailedAt != nil {
		t.Fatalf("sync state %+v", status.Sync)
	}
	listed, err := f.service.Status(context.Background())
	if err != nil || len(listed) != 1 || listed[0].Name != catalog.SourceHikarinagi || listed[0].Sync.Changes != 2 || listed[0].Refreshes != 24*time.Hour {
		t.Fatalf("listed %+v %v", listed, err)
	}
	if _, err := f.service.Sync(context.Background(), "elsewhere"); !errors.Is(err, catalog.ErrUnknownSource) {
		t.Fatalf("an unknown source: %v", err)
	}
}

func TestAFailedPullIsRecordedAndReportedAsTheSourceBeingUnavailable(t *testing.T) {
	f := setup()
	f.source.Err = errors.New("connection refused")
	if _, err := f.service.Sync(context.Background(), catalog.SourceHikarinagi); !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("expected source unavailable, got %v", err)
	}
	if err := f.service.PullChanges(context.Background()); !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("the scheduled pull fails the same way: %v", err)
	}
	listed, err := f.service.Status(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	state := listed[0].Sync
	if state.FailedAt == nil || !state.FailedAt.Equal(now) || state.LastError == nil || *state.LastError != "connection refused" || state.PulledAt != nil {
		t.Fatalf("sync state %+v", state)
	}
}

func TestASourceWithoutAChangeFeedCannotBePulled(t *testing.T) {
	f := setup()
	plain := plainSource{name: "plain"}
	service := catalog.NewService(catalog.Deps{
		Sources:  []catalog.Source{plain},
		Store:    f.store,
		Tx:       f.tx,
		Queue:    f.queue,
		Now:      func() time.Time { return now },
		Settings: catalogSettings(),
	})
	if _, err := service.Sync(context.Background(), "plain"); !errors.Is(err, catalog.ErrNoChangeFeed) {
		t.Fatalf("expected no change feed, got %v", err)
	}
	listed, err := service.Status(context.Background())
	if err != nil || len(listed) != 1 || listed[0].Incremental {
		t.Fatalf("listed %+v %v", listed, err)
	}
	if err := service.PullChanges(context.Background()); err != nil {
		t.Fatalf("the scheduled pull skips it: %v", err)
	}
}

func TestExcludedEntriesArePaged(t *testing.T) {
	f := setup()
	for _, externalID := range []string{"1", "2", "3"} {
		id := f.store.Seed(ref(catalog.EntityGame, externalID), &now)
		if err := f.service.Exclude(context.Background(), catalog.EntityGame, id, catalog.Exclusion{Title: "game " + externalID, UserID: 4}); err != nil {
			t.Fatal(err)
		}
	}
	entries, total, err := f.service.ExcludedEntries(context.Background(), 2, 2)
	if err != nil || total != 3 || len(entries) != 1 {
		t.Fatalf("second page %+v %d %v", entries, total, err)
	}
	if entries[0].Title == nil || entries[0].ExcludedBy == nil || entries[0].ExcludedBy.ID != 4 {
		t.Fatalf("entry %+v", entries[0])
	}
}

type plainSource struct {
	name string
}

func (s plainSource) Name() string { return s.name }

func (plainSource) Game(context.Context, string) (catalog.GameSnapshot, error) {
	return catalog.GameSnapshot{}, catalog.ErrNotFound
}

func (plainSource) Developer(context.Context, string) (catalog.DeveloperSnapshot, error) {
	return catalog.DeveloperSnapshot{}, catalog.ErrNotFound
}

func (plainSource) Character(context.Context, string) (catalog.CharacterSnapshot, error) {
	return catalog.CharacterSnapshot{}, catalog.ErrNotFound
}

func (plainSource) Search(context.Context, catalog.Entity, string, int, int) ([]catalog.SearchHit, int, error) {
	return nil, 0, nil
}
