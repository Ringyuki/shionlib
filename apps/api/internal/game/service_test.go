package game_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
)

var (
	now        = time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	guest      = actor.Guest()
	strictUser = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	permissive = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
)

func ptr[T any](v T) *T {
	return &v
}

func safe(id int) gametest.Entry {
	return gametest.Entry{HasResources: true, Detail: game.Detail{ID: id, TitleJP: "safe", Covers: []game.Cover{{URL: "safe.webp"}}}}
}

func ratedCover(id int) gametest.Entry {
	return gametest.Entry{HasResources: true, Detail: game.Detail{ID: id, Covers: []game.Cover{{URL: "safe.webp"}, {URL: "rated.webp", Sexual: 1}}}}
}

func nsfw(id int) gametest.Entry {
	return gametest.Entry{HasResources: true, Detail: game.Detail{ID: id, NSFW: true}}
}

type fixture struct {
	catalog *gametest.Catalog
	recent  *gametest.RecentUpdates
	prefs   gametest.Preferences
	service *game.Service
}

func newFixture(entries ...gametest.Entry) fixture {
	catalog := gametest.NewCatalog(entries...)
	recent := &gametest.RecentUpdates{}
	prefs := gametest.Preferences{}
	service := game.NewService(catalog, recent, prefs, game.NewCardService(catalog), func() time.Time { return now }, func(n int) int { return n - 1 })
	return fixture{catalog: catalog, recent: recent, prefs: prefs, service: service}
}

func ids(cards []game.Card) []int {
	out := make([]int, len(cards))
	for i, card := range cards {
		out[i] = card.ID
	}
	return out
}

func TestListResolvesVisibilityAndResourcePreference(t *testing.T) {
	ctx := context.Background()
	withoutResources := safe(4)
	withoutResources.HasResources = false
	f := newFixture(safe(1), ratedCover(2), nsfw(3), withoutResources)
	page := game.Page{Number: 1, Size: 10}

	cards, total, err := f.service.List(ctx, guest, game.ListQuery{Page: page})
	if err != nil || total != 1 || !slices.Equal(ids(cards), []int{1}) {
		t.Fatalf("guests see safe games with resources only: %v %d %v", ids(cards), total, err)
	}
	if filter := f.catalog.LastFilter; !filter.ExcludeRated || !filter.OnlyWithResources || filter.SortBy != game.SortByReleaseDate || filter.SortOrder != game.SortDescending {
		t.Fatalf("unexpected guest filter %+v", filter)
	}

	f.prefs[permissive.UserID] = false
	cards, _, _ = f.service.List(ctx, permissive, game.ListQuery{Page: page})
	if !slices.Equal(ids(cards), []int{4, 3, 2, 1}) {
		t.Fatalf("permissive user without the resource setting sees everything: %v", ids(cards))
	}
	if covers := cards[2].Covers; len(covers) != 2 {
		t.Fatalf("permissive viewers keep rated covers: %+v", covers)
	}

	cards, _, _ = f.service.List(ctx, strictUser, game.ListQuery{Page: page})
	if !slices.Equal(ids(cards), []int{1}) || !f.catalog.LastFilter.OnlyWithResources {
		t.Fatalf("users default to the resource filter: %v %+v", ids(cards), f.catalog.LastFilter)
	}

	f.catalog.Put(gametest.Entry{Detail: game.Detail{ID: 9}, DeveloperIDs: []int{7}})
	cards, _, _ = f.service.List(ctx, guest, game.ListQuery{Page: page, DeveloperID: ptr(7)})
	if !slices.Equal(ids(cards), []int{9}) || f.catalog.LastFilter.OnlyWithResources {
		t.Fatalf("developer pages show every game: %v %+v", ids(cards), f.catalog.LastFilter)
	}
}

func TestListForwardsFilters(t *testing.T) {
	f := newFixture()
	start := now.Add(-time.Hour)
	_, _, err := f.service.List(context.Background(), permissive, game.ListQuery{
		Page: game.Page{Number: 2, Size: 5}, Tags: []string{"a"}, ExcludeTags: []string{"b"}, Platforms: []string{"win"},
		Years: []int{2021, 2020, 2020}, Months: []int{3}, SortBy: game.SortByHotScore, SortOrder: game.SortAscending,
		StartDate: &start, CharacterID: ptr(0),
	})
	if err != nil {
		t.Fatal(err)
	}
	filter := f.catalog.LastFilter
	if !slices.Equal(filter.ReleasePeriods, []string{"2020-03", "2021-03"}) || filter.SortBy != game.SortByHotScore || filter.SortOrder != game.SortAscending {
		t.Fatalf("unexpected filter %+v", filter)
	}
	if filter.CharacterID != nil || filter.ReleasedAfter == nil || !filter.ReleasedAfter.Equal(start) || filter.Tags[0] != "a" || filter.ExcludeTags[0] != "b" || filter.Platforms[0] != "win" {
		t.Fatalf("unexpected filter %+v", filter)
	}
	if filter.ExcludeRated || !filter.OnlyWithResources {
		t.Fatalf("zero character id is not an entity page: %+v", filter)
	}
}

func TestReleasePeriods(t *testing.T) {
	cases := []struct {
		name   string
		years  []int
		months []int
		want   []string
	}{
		{name: "nothing", want: nil},
		{name: "cartesian", years: []int{2021, 2020}, months: []int{12, 1}, want: []string{"2020-01", "2020-12", "2021-01", "2021-12"}},
		{name: "years only", years: []int{2020, 2020}, want: []string{"2020"}},
		{name: "months use the current year", months: []int{2, 13, 0}, want: []string{"2026-02"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := game.ReleasePeriods(tc.years, tc.months, now); !slices.Equal(got, tc.want) {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}

func TestRandomDrawsFromVisibleGames(t *testing.T) {
	ctx := context.Background()
	f := newFixture(safe(1), ratedCover(2))
	id, ok, err := f.service.Random(ctx, guest)
	if err != nil || !ok || id != 1 {
		t.Fatalf("strict viewers only draw safe games: %d %v %v", id, ok, err)
	}
	id, ok, _ = f.service.Random(ctx, permissive)
	if !ok || id != 2 {
		t.Fatalf("permissive viewers draw from every game: %d %v", id, ok)
	}
	empty := newFixture(nsfw(1))
	if _, ok, err := empty.service.Random(ctx, guest); ok || err != nil {
		t.Fatalf("nothing to draw: %v %v", ok, err)
	}
}

func TestRecentUpdatesKeepScoreOrderAndFilter(t *testing.T) {
	hidden := safe(3)
	hidden.Hidden = true
	f := newFixture(safe(1), ratedCover(2), hidden, safe(9))
	f.recent.IDs = []int{2, 1, 9, 3, 404}
	cards, total, err := f.service.RecentUpdates(context.Background(), guest, game.Page{Number: 1, Size: 10})
	if err != nil || total != 5 || !slices.Equal(ids(cards), []int{1, 9}) {
		t.Fatalf("unexpected recent updates %v %d %v", ids(cards), total, err)
	}
	if !f.recent.ExpiredBefore.Equal(now.Add(-30 * 24 * time.Hour)) {
		t.Fatalf("entries older than 30 days are purged: %v", f.recent.ExpiredBefore)
	}
	cards, _, _ = f.service.RecentUpdates(context.Background(), permissive, game.Page{Number: 1, Size: 10})
	if !slices.Equal(ids(cards), []int{2, 1, 9}) {
		t.Fatalf("permissive order: %v", ids(cards))
	}
}

func TestDetailVisibility(t *testing.T) {
	ctx := context.Background()
	rich := gametest.Entry{Detail: game.Detail{
		ID:     1,
		Covers: []game.Cover{{URL: "c.webp"}},
		Images: []game.Image{{URL: "safe.webp"}, {URL: "rated.webp", Sexual: 2}},
		Relations: []game.Relation{
			{ID: 10, Kind: "SEQUEL", ToGameID: 2},
			{ID: 11, Kind: "PREQUEL", ToGameID: 3},
			{ID: 12, Kind: "VARIANT", ToGameID: 4},
		},
	}}
	hidden := safe(4)
	hidden.Hidden = true
	f := newFixture(rich, safe(2), ratedCover(3), hidden, nsfw(5), ratedCover(6))

	for _, id := range []int{5, 6, 404} {
		if _, err := f.service.Get(ctx, guest, id); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("game %d must be hidden from strict viewers: %v", id, err)
		}
		if _, err := f.service.Header(ctx, strictUser, id); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("header %d must be hidden from strict viewers: %v", id, err)
		}
	}
	if _, err := f.service.Get(ctx, guest, 4); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("hidden games are not found: %v", err)
	}
	if detail, err := f.service.Get(ctx, permissive, 6); err != nil || len(detail.Covers) != 2 {
		t.Fatalf("permissive viewers open rated games: %+v %v", detail, err)
	}

	strict, err := f.service.Get(ctx, guest, 1)
	if err != nil || !strict.ImagesWithheld || strict.Images != nil {
		t.Fatalf("strict viewers get no images on the overview: %+v %v", strict, err)
	}
	full, _ := f.service.Get(ctx, permissive, 1)
	if full.ImagesWithheld || len(full.Images) != 2 {
		t.Fatalf("permissive viewers get every image: %+v", full)
	}

	details, err := f.service.Details(ctx, guest, 1)
	if err != nil || len(details.Images) != 1 || details.Images[0].URL != "safe.webp" || details.ImagesWithheld {
		t.Fatalf("details filter rated images for strict viewers: %+v %v", details.Images, err)
	}
	if len(details.Relations) != 1 || details.Relations[0].ID != 10 || details.Relations[0].Target.ID != 2 || details.Relations[0].Target.TitleJP != "safe" {
		t.Fatalf("strict viewers only see safe visible relation targets: %+v", details.Relations)
	}
	all, _ := f.service.Details(ctx, permissive, 1)
	if len(all.Relations) != 2 || len(all.Relations[1].Target.Covers) != 2 {
		t.Fatalf("permissive viewers see rated relation targets: %+v", all.Relations)
	}
}

func TestIncreaseViews(t *testing.T) {
	f := newFixture(safe(1))
	if err := f.service.IncreaseViews(context.Background(), 1); err != nil || f.catalog.Views(1) != 1 {
		t.Fatalf("views: %d %v", f.catalog.Views(1), err)
	}
	if err := f.service.IncreaseViews(context.Background(), 404); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
}

func TestBangumiScore(t *testing.T) {
	ctx := context.Background()
	withBangumi := safe(1)
	withBangumi.Detail.BID = ptr("42")
	hiddenWithBangumi := safe(3)
	hiddenWithBangumi.Hidden = true
	hiddenWithBangumi.Detail.BID = ptr("42")
	catalog := gametest.NewCatalog(withBangumi, safe(2), hiddenWithBangumi)
	bangumi := &gametest.Bangumi{Scores: map[string]game.BangumiScore{"42": {ID: 42, Rating: game.BangumiRating{Rank: 3, Score: 8.1}}}}
	cache := gametest.NewCache()
	service := game.NewScoreService(catalog, bangumi, &gametest.VNDB{}, cache)

	if _, err := service.Bangumi(ctx, 404); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	if score, err := service.Bangumi(ctx, 2); err != nil || score != nil {
		t.Fatalf("games without a bangumi id have no score: %+v %v", score, err)
	}
	score, err := service.Bangumi(ctx, 1)
	if err != nil || score == nil || score.ID != 42 || score.Rating.Rank != 3 {
		t.Fatalf("score: %+v %v", score, err)
	}
	if cache.TTLs["game:score:bangumi:42"] != 7*24*time.Hour {
		t.Fatalf("score must be cached for seven days: %v", cache.TTLs)
	}
	if again, err := service.Bangumi(ctx, 3); err != nil || again.Rating.Score != 8.1 || bangumi.Calls != 1 {
		t.Fatalf("cached score is reused regardless of game status: %+v %d %v", again, bangumi.Calls, err)
	}

	failing := game.NewScoreService(catalog, &gametest.Bangumi{Err: game.ErrBangumiRequestFailed.WithArgs(map[string]any{"message": "boom"})}, &gametest.VNDB{}, gametest.NewCache())
	if _, err := failing.Bangumi(ctx, 1); !errors.Is(err, game.ErrBangumiRequestFailed) {
		t.Fatalf("upstream failure: %v", err)
	}
}

func TestVNDBScore(t *testing.T) {
	ctx := context.Background()
	withVNDB := safe(1)
	withVNDB.Detail.VID = ptr("v17")
	unknown := safe(2)
	unknown.Detail.VID = ptr("v404")
	vndb := &gametest.VNDB{Scores: map[string]game.VNDBScore{"v17": {ID: "v17", Rating: ptr(85.2), Average: ptr(8.4), VoteCount: 100}}}
	cache := gametest.NewCache()
	service := game.NewScoreService(gametest.NewCatalog(withVNDB, unknown, safe(3)), &gametest.Bangumi{}, vndb, cache)

	if score, err := service.VNDB(ctx, 3); err != nil || score != nil {
		t.Fatalf("no vndb id: %+v %v", score, err)
	}
	if score, err := service.VNDB(ctx, 1); err != nil || score == nil || *score.Rating != 85.2 || score.VoteCount != 100 {
		t.Fatalf("score: %+v %v", score, err)
	}
	if score, err := service.VNDB(ctx, 2); err != nil || score != nil || cache.Has("game:score:vndb:v404") {
		t.Fatalf("unknown entries return nothing and are not cached: %+v %v", score, err)
	}
	failing := game.NewScoreService(gametest.NewCatalog(withVNDB), &gametest.Bangumi{}, &gametest.VNDB{Err: game.ErrVNDBRequestFailed.New()}, gametest.NewCache())
	if _, err := failing.VNDB(ctx, 1); !errors.Is(err, game.ErrVNDBRequestFailed) {
		t.Fatalf("upstream failure: %v", err)
	}
}

func TestBangumiResourceAllowsOnlyKnownPaths(t *testing.T) {
	bangumi := &gametest.Bangumi{Resources: map[string][]byte{"subjects/42": []byte(`{"id":42}`), "characters/7/persons": []byte(`[]`)}}
	service := game.NewScoreService(gametest.NewCatalog(), bangumi, &gametest.VNDB{}, gametest.NewCache())
	ctx := context.Background()
	if raw, err := service.BangumiResource(ctx, game.BangumiResourceQuery{Kind: "subjects", ID: "42"}); err != nil || string(raw) != `{"id":42}` {
		t.Fatalf("subject: %s %v", raw, err)
	}
	if raw, err := service.BangumiResource(ctx, game.BangumiResourceQuery{Kind: "characters", ID: "7", Relation: "persons"}); err != nil || string(raw) != `[]` {
		t.Fatalf("relation: %s %v", raw, err)
	}
	for _, query := range []game.BangumiResourceQuery{
		{Kind: "../oauth", ID: "1"},
		{Kind: "subjects", ID: "1/../../x"},
		{Kind: "subjects", ID: "1", Relation: "image"},
		{Kind: "subjects", ID: ""},
	} {
		if _, err := service.BangumiResource(ctx, query); !errors.Is(err, apperror.ErrValidationFailed) {
			t.Fatalf("query %+v must be rejected: %v", query, err)
		}
	}
}

type hotScoreStore struct {
	weights game.HotScoreWeights
}

func (s *hotScoreStore) RefreshHotScore(_ context.Context, weights game.HotScoreWeights) (int64, error) {
	s.weights = weights
	return 3, nil
}

func TestHotScorePassesConfiguredWeights(t *testing.T) {
	store := &hotScoreStore{}
	weights := game.HotScoreWeights{HalfLifeReleaseDays: 30, Views: 0.6}
	affected, err := game.NewHotScoreService(store, weights).Refresh(context.Background())
	if err != nil || affected != 3 || store.weights != weights {
		t.Fatalf("refresh: %d %v %+v", affected, err, store.weights)
	}
}
