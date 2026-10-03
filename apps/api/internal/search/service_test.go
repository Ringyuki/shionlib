package search_test

import (
	"context"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
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
	engine    *searchtest.Engine
	queue     *searchtest.Queue
	analytics *searchtest.Analytics
	prefs     gametest.Preferences
	service   *search.Service
}

func newFixture(entries ...gametest.Entry) fixture {
	catalog := gametest.NewCatalog(entries...)
	f := fixture{engine: &searchtest.Engine{}, queue: &searchtest.Queue{}, analytics: searchtest.NewAnalytics(), prefs: gametest.Preferences{}}
	f.service = search.NewService(search.Dependencies{
		Engine:      f.engine,
		Catalog:     catalog,
		Tags:        searchtest.Tags{{ID: 1, Name: "school", Count: 5, Aliases: []string{"学园", "School Life"}}, {ID: 2, Name: "fantasy", Count: 9}},
		Cards:       game.NewCards(catalog),
		Preferences: f.prefs,
		Queue:       f.queue,
		Analytics:   f.analytics,
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

func TestGamesHydratesHitsInEngineOrder(t *testing.T) {
	hidden := entry(4, false, true)
	hidden.Hidden = true
	f := newFixture(entry(1, false, true), entry(2, true, true), entry(3, false, false), hidden)
	title := "<span>t</span>"
	f.engine.Result = search.Result{Hits: []search.Hit{{GameID: 3}, {GameID: 2}, {GameID: 1, Highlight: &search.Highlight{TitleJP: &title}}, {GameID: 4}, {GameID: 404}}, Total: 40, TotalPages: 4}

	page, err := f.service.Games(context.Background(), guest, search.Query{Q: " t ", Page: search.Page{Number: 1, Size: 10}})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].Card.ID != 1 || page.Items[0].Highlight == nil || page.Total != 40 || page.TotalPages != 4 {
		t.Fatalf("guests only see safe listable games with resources: %+v", page)
	}
	criteria := f.engine.Criteria[0]
	if criteria.Q != "t" || !criteria.ExcludeRated || !criteria.OnlyWithResources {
		t.Fatalf("unexpected criteria %+v", criteria)
	}
	if len(f.queue.Jobs) != 1 || f.queue.Jobs[0].Query != " t " {
		t.Fatalf("the raw query is recorded: %+v", f.queue.Jobs)
	}

	f.prefs[permissive.UserID] = false
	page, _ = f.service.Games(context.Background(), permissive, search.Query{Tag: "school", Page: search.Page{Number: 1, Size: 10}})
	got := []int{}
	for _, item := range page.Items {
		got = append(got, item.Card.ID)
	}
	if !slices.Equal(got, []int{3, 2, 1}) || len(page.Items[1].Card.Covers) != 2 {
		t.Fatalf("permissive viewers without the resource setting: %v", page.Items)
	}
	if len(f.queue.Jobs) != 1 || f.engine.Criteria[1].ExcludeRated || f.engine.Criteria[1].OnlyWithResources || f.engine.Criteria[1].Tag != "school" {
		t.Fatalf("tag-only searches are not recorded: %+v %+v", f.queue.Jobs, f.engine.Criteria[1])
	}
}

func TestGamesWithoutTermsIsEmpty(t *testing.T) {
	f := newFixture()
	page, err := f.service.Games(context.Background(), guest, search.Query{Q: "  ", Tag: " ", Page: search.Page{Number: 1, Size: 10}})
	if err != nil || len(page.Items) != 0 || page.Total != 0 || len(f.engine.Criteria) != 0 {
		t.Fatalf("blank queries skip the engine: %+v %v", page, err)
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

func TestAnalyticsRecordingTrendsAndSuggestions(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	for _, q := range []string{"  Sakura ", "sakura", "さくら", "  "} {
		if err := f.service.RecordSearch(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	long := make([]rune, search.MaxRecordedQueryLength+1)
	for i := range long {
		long[i] = 'x'
	}
	if err := f.service.RecordSearch(ctx, string(long)); err != nil {
		t.Fatal(err)
	}
	if f.analytics.Trends[search.WindowHour]["sakura"] != 2 || len(f.analytics.Trends[search.WindowDay]) != 2 {
		t.Fatalf("unexpected trends %+v", f.analytics.Trends)
	}
	if f.analytics.Prefixes["さ"]["さくら"] != 1 || f.analytics.Prefixes["さく"]["さくら"] != 1 || f.analytics.Prefixes["sak"]["sakura"] != 2 {
		t.Fatalf("prefixes are built per character: %+v", f.analytics.Prefixes)
	}
	if _, ok := f.analytics.Prefixes[string([]byte("さ")[:1])]; ok {
		t.Fatal("prefixes must not split multi-byte characters")
	}

	trending, err := f.service.Trending(ctx, 1, nil)
	if err != nil || len(trending) != 1 || trending[0] != (search.Term{Query: "sakura", Score: 6}) {
		t.Fatalf("scores are summed across windows: %+v %v", trending, err)
	}
	window := search.WindowHour
	trending, _ = f.service.Trending(ctx, 10, &window)
	if len(trending) != 2 || trending[0].Score != 2 {
		t.Fatalf("single window: %+v", trending)
	}
	suggestions, _ := f.service.Suggest(ctx, "SA", 10)
	if len(suggestions) != 1 || suggestions[0].Query != "sakura" {
		t.Fatalf("prefix is lower-cased: %+v", suggestions)
	}

	if err := f.service.DecayTrends(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.service.DecaySuggestions(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.service.TrimSuggestions(ctx); err != nil {
		t.Fatal(err)
	}
	if f.analytics.Trends[search.WindowHour]["sakura"] != 2*search.DecayFactor || f.analytics.TrimmedKeep != search.MaxCandidatesPerPrefix {
		t.Fatalf("decay and trim: %+v %d", f.analytics.Trends, f.analytics.TrimmedKeep)
	}
}
