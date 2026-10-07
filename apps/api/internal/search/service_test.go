package search_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/search/searchtest"
)

var (
	guest      = actor.Guest()
	permissive = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitShowSpoiler}
)

type fixture struct {
	catalog   *searchtest.Catalog
	titles    *searchtest.Titles
	cache     *gametest.Cache
	queue     *searchtest.Queue
	analytics *searchtest.Analytics
	service   *search.Service
}

func newFixture(entries ...gametest.Entry) fixture {
	games := gametest.NewCatalog(entries...)
	f := fixture{
		catalog:   searchtest.NewCatalog(),
		titles:    &searchtest.Titles{Known: []string{"サクラノ詩", "サクラノ刻", "千恋＊万花"}},
		cache:     gametest.NewCache(),
		queue:     &searchtest.Queue{},
		analytics: searchtest.NewAnalytics(),
	}
	f.service = search.NewService(search.Deps{
		Source:     catalog.SourceHikarinagi,
		Catalog:    f.catalog,
		Games:      games,
		Cards:      game.NewCardService(games),
		Developers: searchtest.Developers{50: {ID: 50, Name: "枕", WorksCount: 3}},
		Characters: searchtest.Characters{90: {ID: 90, NameJP: "御桜稟"}},
		Titles:     f.titles,
		Tags:       searchtest.Tags{{ID: 1, Name: "school", Count: 5, Aliases: []string{"学园", "School Life"}}, {ID: 2, Name: "fantasy", Count: 9}},
		Cache:      f.cache,
		Queue:      f.queue,
		Analytics:  f.analytics,
	})
	return f
}

func entry(id int, rated, resources bool) gametest.Entry {
	covers := []game.Cover{{URL: "a.webp"}}
	if rated {
		covers = append(covers, game.Cover{URL: "b.webp", Sexual: 1})
	}
	return gametest.Entry{HasResources: resources, Detail: game.Detail{ID: id, TitleJP: "t", Covers: covers}}
}

func hits(ids ...string) []catalog.SearchHit {
	out := make([]catalog.SearchHit, len(ids))
	for i, id := range ids {
		out[i] = catalog.SearchHit{ExternalID: id, Title: id}
	}
	return out
}

func gameIDs(cards []game.Card) []int {
	ids := make([]int, len(cards))
	for i, card := range cards {
		ids[i] = card.ID
	}
	return ids
}

func everything(q string) search.Query {
	return search.Query{Q: q, Kinds: search.Kinds, Page: 1, Size: 10}
}

func TestSearchMapsUpstreamHitsToLocalEntriesInUpstreamOrder(t *testing.T) {
	hidden := entry(4, false, true)
	hidden.Hidden = true
	f := newFixture(entry(1, false, true), entry(2, true, true), entry(3, false, false), hidden)
	f.catalog.Hits[catalog.EntityGame] = hits("c", "b", "a", "d", "x", "a2")
	f.catalog.Hits[catalog.EntityDeveloper] = hits("5", "6")
	f.catalog.Hits[catalog.EntityCharacter] = hits("9")
	f.catalog.Links[catalog.EntityGame] = map[string]int{"a": 1, "a2": 1, "b": 2, "c": 3, "d": 4}
	f.catalog.Links[catalog.EntityDeveloper] = map[string]int{"5": 50}
	f.catalog.Links[catalog.EntityCharacter] = map[string]int{"9": 90}

	results, err := f.service.Search(context.Background(), guest, everything(" サクラ "))
	if err != nil {
		t.Fatal(err)
	}
	if ids := gameIDs(results.Games.Items); !slices.Equal(ids, []int{3, 1}) || results.Games.Total != 6 {
		t.Fatalf("guests skip rated and hidden games, duplicates collapse, games without resources stay: %v total %d", ids, results.Games.Total)
	}
	if len(results.Developers.Items) != 1 || results.Developers.Items[0].Name != "枕" || results.Developers.Total != 2 {
		t.Fatalf("developers %+v", results.Developers)
	}
	if len(results.Characters.Items) != 1 || results.Characters.Items[0].NameJP != "御桜稟" || results.Characters.Total != 1 {
		t.Fatalf("characters %+v", results.Characters)
	}
	wantUnknown := []catalog.Ref{
		{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "x"},
		{Source: catalog.SourceHikarinagi, Entity: catalog.EntityDeveloper, ExternalID: "6"},
	}
	for _, ref := range wantUnknown {
		if !slices.Contains(f.catalog.Unknown, ref) {
			t.Fatalf("unknown entries are handed to the catalog: %v", f.catalog.Unknown)
		}
	}
	if !slices.Contains(f.catalog.Searches, "hikarinagi:game:サクラ:1:10") {
		t.Fatalf("the query is trimmed before reaching the source: %v", f.catalog.Searches)
	}

	permitted, err := f.service.Search(context.Background(), permissive, everything("サクラ"))
	if err != nil || !slices.Equal(gameIDs(permitted.Games.Items), []int{3, 2, 1}) {
		t.Fatalf("permissive viewers see rated games: %v %v", gameIDs(permitted.Games.Items), err)
	}
}

func TestSearchFindsGamesByReferenceWithoutTheSource(t *testing.T) {
	vndb, bangumi := "v17", "42"
	hikarinagi := 9
	referenced := entry(1, false, false)
	referenced.Detail.VID, referenced.Detail.BID, referenced.Detail.HID = &vndb, &bangumi, &hikarinagi
	rated := entry(2, true, true)
	rated.Detail.VID = &vndb
	f := newFixture(referenced, rated, entry(3, false, true))

	for _, q := range []string{"vid:17", "v17"} {
		results, err := f.service.Search(context.Background(), guest, everything(q))
		if err != nil || !slices.Equal(gameIDs(results.Games.Items), []int{1}) || results.Games.Total != 2 {
			t.Fatalf("%s: guests see the safe game of the two sharing the VNDB id: %v total %d %v", q, gameIDs(results.Games.Items), results.Games.Total, err)
		}
		if len(results.Developers.Items) != 0 || len(results.Characters.Items) != 0 {
			t.Fatalf("%s: references only name games: %+v %+v", q, results.Developers, results.Characters)
		}
	}
	for _, q := range []string{"hid:9", "bid:42"} {
		results, err := f.service.Search(context.Background(), guest, everything(q))
		if err != nil || !slices.Equal(gameIDs(results.Games.Items), []int{1}) {
			t.Fatalf("%s: %v %v", q, gameIDs(results.Games.Items), err)
		}
	}
	paged, err := f.service.Search(context.Background(), permissive, search.Query{Q: "v17", Kinds: search.Kinds, Page: 2, Size: 1})
	if err != nil || !slices.Equal(gameIDs(paged.Games.Items), []int{2}) || paged.Games.Total != 2 {
		t.Fatalf("references page like any other result: %v %v", gameIDs(paged.Games.Items), err)
	}
	if len(f.catalog.Searches) != 0 {
		t.Fatalf("references never reach the source: %v", f.catalog.Searches)
	}
}

func TestSearchOnlyAsksForRequestedKinds(t *testing.T) {
	f := newFixture(entry(1, false, true))
	f.catalog.Hits[catalog.EntityGame] = hits("a")
	f.catalog.Links[catalog.EntityGame] = map[string]int{"a": 1}
	results, err := f.service.Search(context.Background(), guest, search.Query{Q: "a", Kinds: []catalog.Entity{catalog.EntityGame, catalog.EntityGame, "tag"}, Page: 1, Size: 5})
	if err != nil || len(results.Games.Items) != 1 {
		t.Fatalf("games %+v %v", results.Games, err)
	}
	if !slices.Equal(f.catalog.Searches, []string{"hikarinagi:game:a:1:5"}) {
		t.Fatalf("searches %v", f.catalog.Searches)
	}
	if results.Developers.Items == nil || results.Characters.Items == nil {
		t.Fatal("sections that were not requested are empty, not nil")
	}
}

func TestSearchCachesUpstreamPagesPerKeyword(t *testing.T) {
	f := newFixture(entry(1, false, true))
	f.catalog.Hits[catalog.EntityGame] = hits("a", "b")
	f.catalog.Links[catalog.EntityGame] = map[string]int{"a": 1}
	game := func(q string, page int) search.Results {
		t.Helper()
		results, err := f.service.Search(context.Background(), guest, search.Query{Q: q, Kinds: []catalog.Entity{catalog.EntityGame}, Page: page, Size: 1})
		if err != nil {
			t.Fatal(err)
		}
		return results
	}
	game("Sakura", 1)
	if again := game("  sakura ", 1); len(again.Games.Items) != 1 || again.Games.Total != 2 {
		t.Fatalf("cached page %+v", again.Games)
	}
	game("sakura", 2)
	if len(f.catalog.Searches) != 2 {
		t.Fatalf("one upstream call per keyword and page: %v", f.catalog.Searches)
	}
	f.catalog.Links[catalog.EntityGame]["b"] = 1
	if third := game("sakura", 2); len(third.Games.Items) != 1 {
		t.Fatalf("local ids are resolved on every call: %+v", third.Games)
	}
}

func TestBlankSearchSkipsTheSource(t *testing.T) {
	f := newFixture()
	results, err := f.service.Search(context.Background(), guest, everything("   "))
	if err != nil || len(results.Games.Items) != 0 || results.Games.Items == nil || len(f.catalog.Searches) != 0 {
		t.Fatalf("blank queries are empty: %+v %v %v", results, err, f.catalog.Searches)
	}
}

func TestSearchFailsWhenTheSourceIsUnavailable(t *testing.T) {
	f := newFixture()
	f.catalog.Err = catalog.ErrSourceUnavailable.New()
	if _, err := f.service.Search(context.Background(), guest, everything("a")); !errors.Is(err, catalog.ErrSourceUnavailable) {
		t.Fatalf("expected source unavailable, got %v", err)
	}
}

func TestSuggestMatchesLocalTitles(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	suggestions, err := f.service.Suggest(ctx, guest, " サクラ ", 10)
	if err != nil || !slices.Equal(suggestions, []string{"サクラノ詩", "サクラノ刻"}) {
		t.Fatalf("suggestions %v %v", suggestions, err)
	}
	if _, err := f.service.Suggest(ctx, permissive, "千", 1); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(f.titles.Visibility, []game.Visibility{{ExcludeRated: true}, {ExcludeRated: false}}) {
		t.Fatalf("visibility follows the viewer: %v", f.titles.Visibility)
	}
	if blank, err := f.service.Suggest(ctx, guest, "  ", 10); err != nil || blank == nil || len(blank) != 0 || len(f.titles.Visibility) != 2 {
		t.Fatalf("blank prefixes skip the store: %v %v", blank, err)
	}
}

func TestTagsPickDisplayNames(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	all, err := f.service.Tags(ctx, "", 10)
	if err != nil || len(all) != 2 || all[0].Name != "fantasy" || all[0].DisplayName != "fantasy" {
		t.Fatalf("all tags by count: %+v %v", all, err)
	}
	exact, _ := f.service.Tags(ctx, "  School   LIFE ", 10)
	if len(exact) != 1 || exact[0].DisplayName != "School Life" {
		t.Fatalf("exact alias wins: %+v", exact)
	}
	partial, _ := f.service.Tags(ctx, "学", 10)
	if len(partial) != 1 || partial[0].DisplayName != "学园" {
		t.Fatalf("containing alias: %+v", partial)
	}
	byName, _ := f.service.Tags(ctx, "scho", 10)
	if len(byName) != 1 || byName[0].DisplayName != "School Life" {
		t.Fatalf("aliases containing the query are preferred over the name: %+v", byName)
	}
	if none, _ := f.service.Tags(ctx, "", 0); len(none) != 0 {
		t.Fatalf("limit 0 returns nothing: %+v", none)
	}
}

func TestRecordingFeedsTrending(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	long := string(make([]rune, search.MaxRecordedQueryLength+1))
	for _, q := range []string{"  Sakura  No ", "  ", long, "vid:17"} {
		if err := f.service.Record(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	if !slices.Equal(f.queue.Jobs, []search.RecordSearchJob{{Query: "sakura no"}}) {
		t.Fatalf("only meaningful queries are queued, normalized: %+v", f.queue.Jobs)
	}
	for _, q := range []string{"sakura no", "SAKURA  no", "さくら", " "} {
		if err := f.service.RecordSearch(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	if f.analytics.Trends[search.WindowHour]["sakura no"] != 2 || len(f.analytics.Trends[search.WindowDay]) != 2 {
		t.Fatalf("unexpected trends %+v", f.analytics.Trends)
	}
	trending, err := f.service.Trending(ctx, 1, nil)
	if err != nil || len(trending) != 1 || trending[0] != (search.Term{Query: "sakura no", Score: 6}) {
		t.Fatalf("scores are summed across windows: %+v %v", trending, err)
	}
	window := search.WindowHour
	if single, _ := f.service.Trending(ctx, 10, &window); len(single) != 2 || single[0].Score != 2 {
		t.Fatalf("single window: %+v", single)
	}
	if err := f.service.DecayTrends(ctx); err != nil {
		t.Fatal(err)
	}
	if f.analytics.Trends[search.WindowHour]["sakura no"] != 2*search.DecayFactor {
		t.Fatalf("decay: %+v", f.analytics.Trends)
	}
}
