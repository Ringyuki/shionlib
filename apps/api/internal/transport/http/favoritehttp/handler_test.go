package favoritehttp_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite/favoritetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/favoritehttp"
)

var (
	owner  = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	reader = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
)

func setup(t *testing.T) (*apitest.Server, *favoritetest.MemoryRepository) {
	t.Helper()
	server := apitest.New(t)
	repo := favoritetest.NewMemoryRepository(func() time.Time { return apitest.Now })
	games := favoritetest.NewGames(game.Card{ID: 10, TitleJP: "タイトル", Covers: []game.Cover{{Language: "jp", Type: "pkgfront", URL: "a.webp", Dims: []int{1, 2}}, {URL: "b.webp", Sexual: 1}}})
	service := favorite.NewService(repo, games, &favoritetest.ImmediateTransactor{})
	favoritehttp.NewHandler(service, server.Builder).Register(server.API)
	return server, repo
}

func TestCreateReturnsCreatedFavorite(t *testing.T) {
	server, _ := setup(t)
	resp := server.Do(apitest.Request{Method: http.MethodPost, Path: "/favorites", As: &owner, Body: map[string]any{"name": "Reading", "is_private": true}})
	server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"id":1,"name":"Reading","description":null,"is_private":true}` {
		t.Fatalf("unexpected body %s", resp.Data)
	}
	dup := server.Do(apitest.Request{Method: http.MethodPost, Path: "/favorites", As: &owner, Body: map[string]any{"name": "Reading", "is_private": false}})
	server.Expect(dup, http.StatusConflict, 460101)
}

func TestCreateValidation(t *testing.T) {
	server, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/favorites", Body: map[string]any{"name": "x", "is_private": false}}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/favorites", As: &owner, Body: map[string]any{"name": "", "is_private": false}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/favorites", As: &owner, Body: map[string]any{"name": "x"}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/favorites", As: &owner, Body: map[string]any{"name": "x", "is_private": "yes"}}), http.StatusUnprocessableEntity, 100101)
}

func TestMutationsReturnEmptyEnvelopes(t *testing.T) {
	server, repo := setup(t)
	fav := repo.Seed(favorite.Favorite{UserID: owner.UserID, Name: "list"})
	path := "/favorites/" + itoa(fav.ID)

	resp := server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &owner, Body: map[string]any{"game_id": 10, "note": "great"}})
	server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("void endpoints must omit data: %s", resp.Body)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &owner, Body: map[string]any{"game_id": 10}}), http.StatusConflict, 460102)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &owner, Body: map[string]any{"game_id": 99}}), http.StatusNotFound, 400101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &reader, Body: map[string]any{"game_id": 10}}), http.StatusForbidden, 460106)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &owner, Body: map[string]any{"is_private": true}}), http.StatusOK, 0)

	item, _, _ := repo.FindItem(t.Context(), fav.ID, 10)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: "/favorites/items/" + itoa(item.ID), As: &reader, Body: map[string]any{"note": "mine"}}), http.StatusForbidden, 460105)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: "/favorites/items/" + itoa(item.ID), As: &owner, Body: map[string]any{"note": "mine"}}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path + "/games/10", As: &owner}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/favorites/items/" + itoa(item.ID), As: &owner}), http.StatusNotFound, 460104)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &owner}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &owner}), http.StatusNotFound, 460103)
}

func TestListShapes(t *testing.T) {
	server, repo := setup(t)
	fav := repo.Seed(favorite.Favorite{UserID: owner.UserID, Name: "default", Default: true})
	repo.Seed(favorite.Favorite{UserID: owner.UserID, Name: "hidden", IsPrivate: true})
	if err := repo.CreateItem(t.Context(), favorite.NewItem{FavoriteID: fav.ID, GameID: 10}); err != nil {
		t.Fatal(err)
	}

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites?user_id=1&game_id=10", As: &reader})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"id":1,"name":"default","description":null,"is_private":false,"default":true,"game_count":1,"is_favorite":true}]` {
		t.Fatalf("unexpected list %s", resp.Data)
	}
	own := server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites", As: &owner})
	var lists []map[string]any
	own.Decode(t, &lists)
	if len(lists) != 2 {
		t.Fatalf("owner should see private lists too: %s", own.Data)
	}
	if _, present := lists[0]["is_favorite"]; present {
		t.Fatalf("is_favorite is only present when game_id is given: %s", own.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites?game_id=10"}), http.StatusUnauthorized, 200101)
	guest := server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites"})
	server.Expect(guest, http.StatusOK, 0)
	if string(guest.Data) != `[]` {
		t.Fatalf("guests without a target user see nothing: %s", guest.Data)
	}
}

func TestItemsPageWithContentLimitAndCoverFiltering(t *testing.T) {
	server, repo := setup(t)
	fav := repo.Seed(favorite.Favorite{UserID: reader.UserID, Name: "list"})
	if err := repo.CreateItem(t.Context(), favorite.NewItem{FavoriteID: fav.ID, GameID: 10}); err != nil {
		t.Fatal(err)
	}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites/" + itoa(fav.ID) + "/items?page=1&pageSize=2", As: &owner})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":1,"note":null,"game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[{"language":"jp","type":"pkgfront","url":"a.webp","dims":[1,2],"sexual":0,"violence":0}],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]}}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":2,"totalPages":1,"currentPage":1,"content_limit":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected page\n got %s\nwant %s", resp.Data, want)
	}
	guest := server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites/" + itoa(fav.ID) + "/items"})
	server.Expect(guest, http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites/" + itoa(fav.ID) + "/items?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}

func TestGameStatsRequiresLogin(t *testing.T) {
	server, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites/game/10/stats"}), http.StatusUnauthorized, 200101)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/favorites/game/10/stats", As: &owner})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"is_favorite":false}` {
		t.Fatalf("unexpected stats %s", resp.Data)
	}
}

func itoa(v int) string {
	return strconvItoa(v)
}
