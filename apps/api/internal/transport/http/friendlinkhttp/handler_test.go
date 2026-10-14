package friendlinkhttp_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink/friendlinktest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/friendlinkhttp"
)

var (
	viewer = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	admin  = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
)

func setup(t *testing.T) (*apitest.Server, *friendlink.Service) {
	t.Helper()
	server := apitest.New(t)
	service := friendlink.NewService(friendlinktest.NewMemoryRepository(), friendlinktest.Transactor{})
	friendlinkhttp.NewHandler(service, server.Builder).Register(server.API)
	return server, service
}

func TestTheSiteShowsVisibleLinksInTheirOrder(t *testing.T) {
	server, service := setup(t)
	logo := "friend-link/logo/a.webp"
	for _, in := range []friendlink.NewLink{
		{Name: "A", URL: "https://a.example", Logo: &logo, Description: "a", Visible: true},
		{Name: "B", URL: "https://b.example", Visible: false},
		{Name: "C", URL: "https://c.example", Visible: true},
	} {
		if _, err := service.Create(context.Background(), in); err != nil {
			t.Fatal(err)
		}
	}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/friend-links"})
	server.Expect(resp, http.StatusOK, 0)
	want := `[{"id":1,"name":"A","url":"https://a.example","logo":"friend-link/logo/a.webp","description":"a"},{"id":3,"name":"C","url":"https://c.example","logo":null,"description":""}]`
	if string(resp.Data) != want {
		t.Fatalf("unexpected links %s", resp.Data)
	}
}

func TestAdminsManageLinks(t *testing.T) {
	server, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/friend-links"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/friend-links", As: &viewer}), http.StatusForbidden, 403)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/friend-links", As: &admin, Body: map[string]any{"name": "A", "url": "ftp://a.example"}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/friend-links", As: &admin, Body: map[string]any{"name": "A", "url": "https://a.example", "logo": "friend-link/logo/a.webp"}}), http.StatusCreated, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/friend-links", As: &admin, Body: map[string]any{"name": "B", "url": "https://b.example", "visible": false}}), http.StatusCreated, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/friend-links/order", As: &admin, Body: map[string]any{"ids": []int{2, 1}}}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/friend-links/order", As: &admin, Body: map[string]any{"ids": []int{2}}}), http.StatusConflict, 670102)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/friend-links/1", As: &admin, Body: map[string]any{"logo": nil, "description": "简介"}}), http.StatusOK, 0)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/friend-links", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	var links []map[string]any
	resp.Decode(t, &links)
	if len(links) != 2 || links[0]["name"] != "B" || links[0]["visible"] != false || links[1]["logo"] != nil || links[1]["description"] != "简介" {
		t.Fatalf("unexpected links %s", resp.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/friend-links/1", As: &admin}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/friend-links/1", As: &admin}), http.StatusNotFound, 670101)
}
