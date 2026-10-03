package gamehttp_test

import (
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
)

var (
	strict     = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	permissive = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	released   = time.Date(2024, 5, 1, 0, 0, 0, 0, time.UTC)
)

func ptr[T any](v T) *T {
	return &v
}

type env struct {
	server  *apitest.Server
	catalog *gametest.Catalog
	recent  *gametest.RecentUpdates
	bangumi *gametest.Bangumi
}

func detailed() gametest.Entry {
	return gametest.Entry{Views: 7, HasResources: true, Detail: game.Detail{
		ID: 1, VID: ptr("v17"), BID: ptr("42"), HID: ptr(900),
		TitleJP: "タイトル", TitleZH: "标题", Aliases: []string{"alias"}, IntroJP: "紹介", IntroZH: "简介",
		ReleaseDate: &released, ReleaseDateTBA: false, Type: ptr("adv"), Platforms: []string{"win"},
		ExtraInfo:  []game.ExtraInfo{{Key: "官网", Value: "https://example.test"}},
		Staffs:     []game.Staff{{Name: "Writer", Role: "剧本"}},
		Covers:     []game.Cover{{Language: "jp", Type: "pkgfront", URL: "c.webp", Dims: []int{1, 2}}},
		Images:     []game.Image{{URL: "safe.webp", Dims: []int{3, 4}}, {URL: "rated.webp", Sexual: 2}},
		Developers: []game.Credit{{Role: "开发", Developer: game.DeveloperRef{ID: 5, Name: "Yuzu", Aliases: []string{"柚子社"}}}},
		Characters: []game.CharacterCredit{{Role: "main", Image: ptr("ch.webp"), Actor: ptr("CV"), Character: character.Character{
			ID: 8, Image: ptr("ch.webp"), NameJP: "穹", NameZH: ptr("穹"), Aliases: []string{}, BloodType: ptr("ab"), Height: ptr(150), Birthday: []int{3, 14}, Gender: []string{"f"},
		}}},
		Tags:      []game.TagLink{{Tag: game.Tag{ID: 3, Name: "school", Aliases: []string{"学园"}, Count: 9}}},
		Links:     []game.Link{{ID: 4, Name: "official", Label: "Official", URL: "https://example.test"}},
		Relations: []game.Relation{{ID: 6, Kind: "SEQUEL", ToGameID: 2}, {ID: 7, Kind: "PREQUEL", ToGameID: 3}},
	}}
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	catalog := gametest.NewCatalog(
		detailed(),
		gametest.Entry{HasResources: true, Detail: game.Detail{ID: 2, TitleJP: "続編"}},
		gametest.Entry{HasResources: true, Detail: game.Detail{ID: 3, TitleJP: "前作", Covers: []game.Cover{{URL: "r.webp", Sexual: 1}}}},
	)
	recent := &gametest.RecentUpdates{}
	bangumi := &gametest.Bangumi{
		Scores:    map[string]game.BangumiScore{"42": {ID: 42, Rating: game.BangumiRating{Rank: 12, Total: 300, Count: map[string]int{"10": 5}, Score: 7.9}}},
		Resources: map[string][]byte{"subjects/42": []byte(`{"id":42,"name":"x"}`)},
	}
	vndb := &gametest.VNDB{Scores: map[string]game.VNDBScore{"v17": {ID: "v17", Rating: ptr(85.2), Average: ptr(8.4), VoteCount: 1200}}}
	service := game.NewService(catalog, recent, gametest.Preferences{}, game.NewCardService(catalog), func() time.Time { return apitest.Now }, func(int) int { return 0 })
	scores := game.NewScoreService(catalog, bangumi, vndb, gametest.NewCache())
	gamehttp.NewHandler(service, scores, server.Builder).Register(server.API)
	return env{server: server, catalog: catalog, recent: recent, bangumi: bangumi}
}

func TestListShapeAndFilters(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/list?pageSize=1"})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":2,"views":0,"title_jp":"続編","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]}],"meta":{"totalItems":2,"itemCount":1,"itemsPerPage":1,"totalPages":2,"currentPage":1,"content_limit":0}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", resp.Data, want)
	}

	query := "/game/list?page=1&pageSize=100&developer_id=5&filter[tags][]=a&filter[tags][]=b&filter[exclude_tags][]=c&filter[years][]=2020&filter[months][]=3" +
		"&filter[platforms][]=win&filter[sort_by]=hot_score&filter[sort_order]=asc&filter[start_date]=2026-09-25T16:00:00.000Z&filter[end_date]=2026-10-01"
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: query, As: &permissive})
	e.server.Expect(resp, http.StatusOK, 0)
	filter := e.catalog.LastFilter
	if !slices.Equal(filter.Tags, []string{"a", "b"}) || filter.ExcludeTags[0] != "c" || filter.Platforms[0] != "win" || !slices.Equal(filter.ReleasePeriods, []string{"2020-03"}) {
		t.Fatalf("filters were not forwarded: %+v", filter)
	}
	if filter.SortBy != game.SortByHotScore || filter.SortOrder != game.SortAscending || *filter.DeveloperID != 5 || filter.OnlyWithResources || filter.ExcludeRated {
		t.Fatalf("unexpected filter %+v", filter)
	}
	if !filter.ReleasedAfter.Equal(time.Date(2026, 9, 25, 16, 0, 0, 0, time.UTC)) || !filter.ReleasedBefore.Equal(time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("dates: %v %v", filter.ReleasedAfter, filter.ReleasedBefore)
	}

	for _, bad := range []string{"pageSize=101", "filter[years][]=1800", "filter[months][]=13", "filter[sort_by]=title", "filter[start_date]=yesterday", "filter[years][]=x"} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/list?" + bad}), http.StatusUnprocessableEntity, 100101)
	}
}

func TestRandomAndRecentUpdates(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/random"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `1` {
		t.Fatalf("random id: %s", resp.Data)
	}

	e.recent.IDs = []int{3, 2}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/recent-update?pageSize=2"})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":2,"views":0,"title_jp":"続編","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]}],"meta":{"totalItems":2,"itemCount":1,"itemsPerPage":2,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected recent updates\n got %s\nwant %s", resp.Data, want)
	}
}

func TestRandomWithoutCandidatesIsNull(t *testing.T) {
	server := apitest.New(t)
	catalog := gametest.NewCatalog()
	service := game.NewService(catalog, &gametest.RecentUpdates{}, gametest.Preferences{}, game.NewCardService(catalog), time.Now, func(int) int { return 0 })
	gamehttp.NewHandler(service, game.NewScoreService(catalog, &gametest.Bangumi{}, &gametest.VNDB{}, gametest.NewCache()), server.Builder).Register(server.API)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/random"})
	server.Expect(resp, http.StatusOK, 0)
	if !resp.HasData || string(resp.Data) != `null` {
		t.Fatalf("no candidate: %s", resp.Body)
	}
}

func TestDetailEndpoints(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/1", As: &strict})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"title_jp":"タイトル","title_zh":"标题","title_en":"","intro_jp":"紹介","intro_zh":"简介","intro_en":"",` +
		`"covers":[{"language":"jp","type":"pkgfront","url":"c.webp","dims":[1,2],"sexual":0,"violence":0}],` +
		`"developers":[{"role":"开发","developer":{"id":5,"name":"Yuzu","aliases":["柚子社"]}}],` +
		`"characters":[{"role":"main","image":"ch.webp","actor":"CV","character":{"id":8,"image":"ch.webp","name_jp":"穹","name_zh":"穹","name_en":"","aliases":[],"intro_jp":"","intro_zh":"","intro_en":"","gender":["f"],"blood_type":"ab","height":150,"weight":null,"bust":null,"waist":null,"hips":null,"cup":null,"age":null,"birthday":[3,14]}}],` +
		`"staffs":[{"name":"Writer","role":"剧本"}],"tags":[{"tag_alias":null,"tag":{"id":3,"name":"school","aliases":["学园"],"count":9}}],"content_limit":1}`
	if string(resp.Data) != want {
		t.Fatalf("strict overview omits images\n got %s\nwant %s", resp.Data, want)
	}
	var full map[string]any
	permissiveResp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/1", As: &permissive})
	permissiveResp.Decode(t, &full)
	if images, ok := full["images"].([]any); !ok || len(images) != 2 {
		t.Fatalf("permissive overview includes every image: %s", permissiveResp.Data)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/1/header"})
	e.server.Expect(resp, http.StatusOK, 0)
	want = `{"id":1,"v_id":"v17","b_id":"42","h_id":900,"extra_info":[{"key":"官网","value":"https://example.test"}],"title_jp":"タイトル","title_zh":"标题","title_en":"","aliases":["alias"],` +
		`"covers":[{"language":"jp","type":"pkgfront","url":"c.webp","dims":[1,2],"sexual":0,"violence":0}],"developers":[{"role":"开发","developer":{"id":5,"name":"Yuzu","aliases":["柚子社"]}}],` +
		`"release_date":"2024-05-01T00:00:00.000Z","release_date_tba":false,"type":"adv","platform":["win"],"content_limit":0}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected header\n got %s\nwant %s", resp.Data, want)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/1/details"})
	e.server.Expect(resp, http.StatusOK, 0)
	want = `{"id":1,"extra_info":[{"key":"官网","value":"https://example.test"}],"tags":[{"tag_alias":null,"tag":{"id":3,"name":"school","aliases":["学园"],"count":9}}],` +
		`"intro_jp":"紹介","intro_zh":"简介","intro_en":"","images":[{"url":"safe.webp","dims":[3,4],"sexual":0,"violence":0}],"staffs":[{"name":"Writer","role":"剧本"}],"nsfw":false,` +
		`"link":[{"id":4,"name":"official","label":"Official","url":"https://example.test"}],` +
		`"relations_from":[{"id":6,"relation":"SEQUEL","to_game_id":2,"to_game":{"id":2,"title_jp":"続編","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]}}],"content_limit":0}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected details\n got %s\nwant %s", resp.Data, want)
	}

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/1/characters", As: &permissive})
	e.server.Expect(resp, http.StatusOK, 0)
	var characters struct {
		Characters   []map[string]any `json:"characters"`
		ContentLimit int              `json:"content_limit"`
	}
	resp.Decode(t, &characters)
	if len(characters.Characters) != 1 || characters.ContentLimit != 3 || characters.Characters[0]["role"] != "main" {
		t.Fatalf("unexpected characters %s", resp.Data)
	}

	for _, path := range []string{"/game/3", "/game/3/header", "/game/3/details", "/game/3/characters", "/game/404"} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path}), http.StatusNotFound, 400101)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/3", As: &permissive}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/abc"}), http.StatusUnprocessableEntity, 100101)
}

func TestViewCounter(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/2/view"})
	e.server.Expect(resp, http.StatusCreated, 0)
	if resp.HasData || e.catalog.Views(2) != 1 {
		t.Fatalf("view: %s %d", resp.Body, e.catalog.Views(2))
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/404/view"}), http.StatusNotFound, 400101)
}

func TestScores(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/score/bangumi/1"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"rating":{"rank":12,"total":300,"count":{"10":5},"score":7.9},"id":42}` {
		t.Fatalf("bangumi score: %s", resp.Data)
	}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/score/vndb/1"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"id":"v17","rating":85.2,"average":8.4,"votecount":1200}` {
		t.Fatalf("vndb score: %s", resp.Data)
	}
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/score/bangumi/2"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `null` {
		t.Fatalf("no bangumi id: %s", resp.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/score/vndb/404"}), http.StatusNotFound, 400101)

	e.catalog.Put(gametest.Entry{Detail: game.Detail{ID: 9, BID: ptr("77")}})
	e.bangumi.Err = game.ErrBangumiRequestFailed.WithArgs(map[string]any{"message": "Request failed with status code 503"})
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/score/bangumi/9"})
	e.server.Expect(resp, http.StatusBadRequest, 400103)
}

func TestBangumiProxy(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/bangumi/get?id=42"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"id":42,"name":"x"}` {
		t.Fatalf("proxy: %s", resp.Data)
	}
	for _, bad := range []string{"/bangumi/get?path=oauth&id=1", "/bangumi/get?id=1/../x", "/bangumi/get?id=1&type=image", "/bangumi/get"} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: bad}), http.StatusUnprocessableEntity, 100101)
	}
}
