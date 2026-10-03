package potatovnhttp_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn/potatovntest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/potatovnhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var member = actor.Actor{UserID: 4, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}

func setup(t *testing.T) (*apitest.Server, *potatovntest.MemoryRepository, *potatovntest.Client) {
	t.Helper()
	server := apitest.New(t)
	repo := potatovntest.NewMemoryRepository(func() time.Time { return apitest.Now })
	client := potatovntest.NewClient()
	client.Accounts["alice"] = "secret"
	scheduler := &potatovntest.Scheduler{}
	service := potatovn.NewService(repo, repo, client, potatovntest.Covers{}, &txtest.Immediate{}, scheduler.Schedule, func() time.Time { return apitest.Now })
	potatovnhttp.NewHandler(service, server.Builder).Register(server.API)
	return server, repo, client
}

func TestBindingLifecycle(t *testing.T) {
	server, _, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/potatovn/binding"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/potatovn/binding", As: &member}), http.StatusNotFound, 540101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/binding", As: &member, Body: map[string]any{"pvn_user_name": "alice", "pvn_password": ""}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/binding", As: &member, Body: map[string]any{"pvn_user_name": "alice", "pvn_password": "bad"}}), http.StatusUnauthorized, 540103)

	created := server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/binding", As: &member, Body: map[string]any{"pvn_user_name": "alice", "pvn_password": "secret"}})
	server.Expect(created, http.StatusCreated, 0)
	want := `{"pvn_user_id":77,"pvn_user_name":"Canonicalalice","pvn_user_avatar":null,"pvn_token_expires":"2026-12-01T00:00:00Z","created":"2026-10-03T01:02:03Z","updated":"2026-10-03T01:02:03Z"}`
	if string(created.Data) != want {
		t.Fatalf("unexpected binding\n got %s\nwant %s", created.Data, want)
	}
	got := server.Do(apitest.Request{Method: http.MethodGet, Path: "/potatovn/binding", As: &member})
	server.Expect(got, http.StatusOK, 0)
	if string(got.Data) != want {
		t.Fatalf("token must never be returned: %s", got.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/binding", As: &member, Body: map[string]any{"pvn_user_name": "alice", "pvn_password": "secret"}}), http.StatusConflict, 540102)

	deleted := server.Do(apitest.Request{Method: http.MethodDelete, Path: "/potatovn/binding", As: &member})
	server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/potatovn/binding", As: &member}), http.StatusNotFound, 540101)
}

func TestGameMappingRoutes(t *testing.T) {
	server, repo, client := setup(t)
	repo.AddGame(potatovn.GameInfo{ID: 9, TitleJP: "g"})
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/potatovn/game/9", As: &member}), http.StatusNotFound, 550101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/game/404", As: &member}), http.StatusNotFound, 400101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/game/9", As: &member}), http.StatusNotFound, 540101)

	if _, err := repo.CreateBinding(context.Background(), potatovn.NewBinding{UserID: member.UserID, PVNUserID: 1, PVNUserName: "a", Token: "t", TokenExpires: apitest.Now.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	added := server.Do(apitest.Request{Method: http.MethodPost, Path: "/potatovn/game/9", As: &member})
	server.Expect(added, http.StatusCreated, 0)
	want := `{"pvn_galgame_id":1001,"total_play_time":30,"last_play_date":"2023-11-15T22:13:20Z","play_type":1,"my_rate":8,"synced_at":"2026-10-03T01:02:03Z"}`
	if string(added.Data) != want {
		t.Fatalf("unexpected mapping\n got %s\nwant %s", added.Data, want)
	}
	got := server.Do(apitest.Request{Method: http.MethodGet, Path: "/potatovn/game/9", As: &member})
	server.Expect(got, http.StatusOK, 0)
	if string(got.Data) != want {
		t.Fatalf("unexpected mapping %s", got.Data)
	}
	client.FailRemove = potatovn.ErrRequestFailed
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/potatovn/game/9", As: &member}), http.StatusBadGateway, 540104)
	client.FailRemove = nil
	removed := server.Do(apitest.Request{Method: http.MethodDelete, Path: "/potatovn/game/9", As: &member})
	server.Expect(removed, http.StatusOK, 0)
	if removed.HasData {
		t.Fatalf("void endpoints omit data: %s", removed.Body)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/potatovn/game/abc", As: &member}), http.StatusUnprocessableEntity, 100101)
}
