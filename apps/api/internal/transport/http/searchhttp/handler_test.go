package searchhttp_test

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
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
	catalog   *searchtest.Catalog
	queue     *searchtest.Queue
	analytics *searchtest.Analytics
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	games := gametest.NewCatalog(
		gametest.Entry{HasResources: true, Views: 4, Detail: game.Detail{ID: 1, TitleJP: "千恋＊万花"}},
		gametest.Entry{HasResources: true, Detail: game.Detail{ID: 2, TitleJP: "rated", Covers: []game.Cover{{URL: "r.webp", Sexual: 1}}}},
	)
	e := env{server: server, catalog: searchtest.NewCatalog(), queue: &searchtest.Queue{}, analytics: searchtest.NewAnalytics()}
	logo := "m.webp"
	zh := "稟"
	service := search.NewService(search.Deps{
		Source:      catalog.SourceHikarinagi,
		Catalog:     e.catalog,
		Games:       games,
		Cards:       game.NewCardService(games),
		Preferences: gametest.Preferences{permissive.UserID: false},
		Developers:  searchtest.Developers{50: {ID: 50, Name: "枕", Logo: &logo, WorksCount: 3}},
		Characters:  searchtest.Characters{90: {ID: 90, NameJP: "御桜稟", NameZH: &zh, Game: &character.GameRef{ID: 1, TitleJP: "サクラノ詩"}}},
		Titles:      &searchtest.Titles{Known: []string{"千恋＊万花", "千の刃濤"}},
		Tags:        searchtest.Tags{{ID: 1, Name: "school", Count: 5, Aliases: []string{"学园"}}},
		Cache:       gametest.NewCache(),
		Queue:       e.queue,
		Analytics:   e.analytics,
	})
	searchhttp.NewHandler(service, server.Builder).Register(server.API)
	return e
}

type results struct {
	Games struct {
		Items []struct {
			ID      int    `json:"id"`
			TitleJP string `json:"title_jp"`
		} `json:"items"`
		Total int `json:"total"`
	} `json:"games"`
	Developers json.RawMessage `json:"developers"`
	Characters json.RawMessage `json:"characters"`
}

func decode(t *testing.T, raw []byte) results {
	t.Helper()
	var out results
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	return out
}

func TestSearchReturnsOneSectionPerKind(t *testing.T) {
	e := setup(t)
	e.catalog.Hits[catalog.EntityGame] = []catalog.SearchHit{{ExternalID: "b"}, {ExternalID: "a"}, {ExternalID: "x"}}
	e.catalog.Hits[catalog.EntityDeveloper] = []catalog.SearchHit{{ExternalID: "5"}}
	e.catalog.Hits[catalog.EntityCharacter] = []catalog.SearchHit{{ExternalID: "9"}}
	e.catalog.Links[catalog.EntityGame] = map[string]int{"a": 1, "b": 2}
	e.catalog.Links[catalog.EntityDeveloper] = map[string]int{"5": 50}
	e.catalog.Links[catalog.EntityCharacter] = map[string]int{"9": 90}

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search?q=%E5%8D%83&types=game&types=developer&types=character&pageSize=5"})
	e.server.Expect(resp, http.StatusOK, 0)
	got := decode(t, resp.Data)
	if len(got.Games.Items) != 1 || got.Games.Items[0].ID != 1 || got.Games.Items[0].TitleJP != "千恋＊万花" || got.Games.Total != 1 {
		t.Fatalf("guests only get safe games with resources, in source order: %s", resp.Data)
	}
	if string(got.Developers) != `{"items":[{"id":50,"name":"枕","aliases":[],"logo":"m.webp","works_count":3}],"total":1}` {
		t.Fatalf("developers %s", got.Developers)
	}
	if string(got.Characters) != `{"items":[{"id":90,"image":null,"name_jp":"御桜稟","name_zh":"稟","name_en":null,"aliases":[],"game":{"id":1,"title_jp":"サクラノ詩","title_zh":"","title_en":""}}],"total":1}` {
		t.Fatalf("characters %s", got.Characters)
	}
	if !slices.Contains(e.catalog.Searches, "hikarinagi:game:千:1:100") {
		t.Fatalf("games with resources are kept from the source's first hits: %v", e.catalog.Searches)
	}
	if len(e.queue.Jobs) != 0 {
		t.Fatalf("live searches are not recorded: %+v", e.queue.Jobs)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search?q=%E5%8D%83&pageSize=5&resources=any"})
	e.server.Expect(resp, http.StatusOK, 0)
	if got = decode(t, resp.Data); got.Games.Total != 3 || !slices.Contains(e.catalog.Searches, "hikarinagi:game:千:1:5") {
		t.Fatalf("resources=any pages the source directly: %s %v", resp.Data, e.catalog.Searches)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search?q=%E5%8D%83", As: &permissive})
	e.server.Expect(resp, http.StatusOK, 0)
	got = decode(t, resp.Data)
	if len(got.Games.Items) != 2 || got.Games.Items[0].ID != 2 || string(got.Developers) != `{"items":[],"total":0}` {
		t.Fatalf("games are the default kind and permissive viewers see rated ones: %s", resp.Data)
	}
}

func TestSearchRejectsUnknownKindsAndReportsSourceFailures(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search?q=a&types=tag"}), http.StatusUnprocessableEntity, 100101)
	e.catalog.Err = catalog.ErrSourceUnavailable.New()
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search?q=a"}), http.StatusBadGateway, 620101)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search?q="})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"games":{"items":[],"total":0},"developers":{"items":[],"total":0},"characters":{"items":[],"total":0}}` {
		t.Fatalf("blank search: %s", resp.Data)
	}
}

func TestRecordTrendingSuggestionsAndTags(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/search/record", Body: map[string]string{"q": " Sakura "}}), http.StatusCreated, 0)
	if !slices.Equal(e.queue.Jobs, []search.RecordSearchJob{{Query: "sakura"}}) {
		t.Fatalf("settled keywords are queued: %+v", e.queue.Jobs)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/search/record", Body: map[string]string{"q": ""}}), http.StatusUnprocessableEntity, 100101)

	if err := e.analytics.Increment(context.Background(), "sakura", search.Windows); err != nil {
		t.Fatal(err)
	}
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/trending?window=1h"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"query":"sakura","score":1}]` {
		t.Fatalf("trending: %s", resp.Data)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/suggest?prefix=%E5%8D%83%E6%81%8B"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `["千恋＊万花"]` {
		t.Fatalf("suggestions: %s", resp.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/suggest"}), http.StatusUnprocessableEntity, 100101)

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/tags?q=%E5%AD%A6"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"id":1,"name":"school","count":5,"aliases":["学园"],"display_name":"学园"}]` {
		t.Fatalf("tags: %s", resp.Data)
	}
}
