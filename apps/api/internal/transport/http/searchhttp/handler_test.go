package searchhttp_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/search/searchtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/searchhttp"
)

var permissive = actor.Actor{UserID: 3, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}

type env struct {
	server    *apitest.Server
	engine    *searchtest.Engine
	queue     *searchtest.Queue
	analytics *searchtest.Analytics
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	catalog := gametest.NewCatalog(
		gametest.Entry{HasResources: true, Views: 4, Detail: game.Detail{ID: 1, TitleJP: "千恋＊万花"}},
		gametest.Entry{HasResources: true, Detail: game.Detail{ID: 2, TitleJP: "rated", Covers: []game.Cover{{URL: "r.webp", Sexual: 1}}}},
	)
	e := env{server: server, engine: &searchtest.Engine{}, queue: &searchtest.Queue{}, analytics: searchtest.NewAnalytics()}
	service := search.NewService(search.Deps{
		Engine: e.engine, Catalog: catalog, Cards: game.NewCardService(catalog), Preferences: gametest.Preferences{},
		Tags:  searchtest.Tags{{ID: 1, Name: "school", Count: 5, Aliases: []string{"学园"}}},
		Queue: e.queue, Analytics: e.analytics,
	})
	searchhttp.NewHandler(service, server.Builder).Register(server.API)
	return e
}

func TestSearchGamesShape(t *testing.T) {
	e := setup(t)
	highlight := `<span class="search-highlight">千恋</span>＊万花`
	e.engine.Result = search.Result{Hits: []search.Hit{{GameID: 2}, {GameID: 1, Highlight: &search.Highlight{TitleJP: &highlight}}}, Total: 2, TotalPages: 1}

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/games?q=%E5%8D%83%E6%81%8B&pageSize=20"})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":1,"views":4,"title_jp":"千恋＊万花","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[],"_formatted":{"title_jp":"<span class=\"search-highlight\">千恋</span>＊万花"}}],"meta":{"totalItems":2,"itemCount":1,"itemsPerPage":20,"totalPages":1,"currentPage":1,"content_limit":0}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected search page\n got %s\nwant %s", resp.Data, want)
	}
	if len(e.queue.Jobs) != 1 || e.queue.Jobs[0].Query != "千恋" {
		t.Fatalf("keyword searches are recorded: %+v", e.queue.Jobs)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/games", As: &permissive})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"items":[],"meta":{"totalItems":0,"itemCount":0,"itemsPerPage":10,"totalPages":0,"currentPage":1,"content_limit":3}}` {
		t.Fatalf("empty search: %s", resp.Data)
	}
}

func TestTagsTrendingAndSuggestions(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/tags?q=%E5%AD%A6"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"id":1,"name":"school","count":5,"aliases":["学园"],"display_name":"学园"}]` {
		t.Fatalf("tags: %s", resp.Data)
	}

	if err := e.analytics.Increment(context.Background(), "sakura", search.Windows, []string{"s", "sa"}, 200); err != nil {
		t.Fatal(err)
	}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/trending?window=1h"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"query":"sakura","score":1}]` {
		t.Fatalf("trending: %s", resp.Data)
	}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/trending"})
	if string(resp.Data) != `[{"query":"sakura","score":3}]` {
		t.Fatalf("summed trending: %s", resp.Data)
	}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/suggest?prefix=SA"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"query":"sakura","score":1}]` {
		t.Fatalf("suggest: %s", resp.Data)
	}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/suggest?prefix=zz"})
	if string(resp.Data) != `[]` {
		t.Fatalf("empty suggestions: %s", resp.Data)
	}
	for _, bad := range []string{"/search/suggest", "/search/suggest?prefix=", "/search/trending?window=2h", "/search/trending?limit=51", "/search/tags?limit=101"} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: bad}), http.StatusUnprocessableEntity, 100101)
	}
}
