package apikeyhttp_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey/apikeytest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apikeyhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

var (
	member = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	admin  = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
)

type services struct {
	keys   *apikey.Service
	access *apikey.AccessService
	admin  *apikey.AdminService
}

func setup(t *testing.T) (*apitest.Server, *apikeytest.UsageStore, services) {
	t.Helper()
	server := apitest.New(t)
	repo := apikeytest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.AddUser(member.UserID, apikey.Owner{})
	usage := &apikeytest.UsageStore{Details: map[int]apikey.Detail{}}
	deps := apikey.Deps{
		Repo:     repo,
		Usage:    usage,
		Counter:  apikeytest.NewCounter(),
		Messages: &apikeytest.Messages{},
		Tx:       apikeytest.Transactor{},
		Settings: settingtest.Source{},
		Now:      func() time.Time { return apitest.Now },
	}
	all := services{keys: apikey.NewService(deps), access: apikey.NewAccessService(deps), admin: apikey.NewAdminService(deps)}
	apikeyhttp.NewHandler(all.keys, server.Builder).Register(server.API)
	apikeyhttp.NewAdminHandler(all.admin, server.Builder).Register(server.API)
	return server, usage, all
}

func TestMembersCreateListAndDeleteTheirKeys(t *testing.T) {
	server, _, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/api-keys"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/api-keys", As: &member, Body: map[string]any{"name": ""}}), http.StatusUnprocessableEntity, 100101)
	created := server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/api-keys", As: &member, Body: map[string]any{"name": "ReinaManager"}})
	server.Expect(created, http.StatusCreated, 0)
	var issued struct {
		Key struct {
			ID     int    `json:"id"`
			Prefix string `json:"prefix"`
			Status string `json:"status"`
		} `json:"key"`
		Secret string `json:"secret"`
	}
	created.Decode(t, &issued)
	if !strings.HasPrefix(issued.Secret, "shl_") || issued.Key.Prefix != issued.Secret[:12] || issued.Key.Status != "active" {
		t.Fatalf("unexpected key %s", created.Data)
	}
	listed := server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/api-keys", As: &member})
	server.Expect(listed, http.StatusOK, 0)
	if strings.Contains(string(listed.Data), issued.Secret) || !strings.Contains(string(listed.Data), `"limit":10`) || !strings.Contains(string(listed.Data), `"enabled":true`) {
		t.Fatalf("the list never holds the secret: %s", listed.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/user/api-keys/99", As: &member}), http.StatusNotFound, 680107)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/user/api-keys/" + strconv.Itoa(issued.Key.ID), As: &member}), http.StatusOK, 0)
}

func TestAdministratorsSuspendKeysAndSetLimits(t *testing.T) {
	server, usage, service := setup(t)
	issued, err := service.keys.Create(t.Context(), member, "bot")
	if err != nil {
		t.Fatal(err)
	}
	usage.Listed = []apikey.Listed{{Key: issued.Key, Recent: apikey.Usage{Requests: 41203, Throttled: 1876}}}
	usage.Details[issued.Key.ID] = apikey.Detail{Listed: usage.Listed[0]}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/open/keys", As: &member}), http.StatusForbidden, 403)
	list := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/open/keys?sort=used&status=active", As: &admin})
	server.Expect(list, http.StatusOK, 0)
	if !strings.Contains(string(list.Data), `"recent":{"requests":41203,"throttled":1876}`) {
		t.Fatalf("recent use is listed: %s", list.Data)
	}
	detail := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/open/keys/" + strconv.Itoa(issued.Key.ID), As: &admin})
	server.Expect(detail, http.StatusOK, 0)
	if !strings.Contains(string(detail.Data), `"days":[`) || !strings.Contains(string(detail.Data), `"account_limit":null`) {
		t.Fatalf("detail: %s", detail.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/open/keys/" + strconv.Itoa(issued.Key.ID) + "/suspend", As: &admin, Body: map[string]any{"reason": ""}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/open/keys/" + strconv.Itoa(issued.Key.ID) + "/suspend", As: &admin, Body: map[string]any{"reason": "abuse"}}), http.StatusOK, 0)
	if _, err := service.access.Authenticate(t.Context(), issued.Secret, "203.0.113.1"); err == nil {
		t.Fatal("a suspended key is refused")
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/open/keys/" + strconv.Itoa(issued.Key.ID) + "/restore", As: &admin}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/open/accounts/1/limit", As: &admin, Body: map[string]any{"limit": 300}}), http.StatusOK, 0)
	holder, err := service.access.Authenticate(t.Context(), issued.Secret, "203.0.113.1")
	if err != nil || holder.Limit == nil || *holder.Limit != 300 {
		t.Fatalf("restored with the account's own limit: %+v %v", holder, err)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/open/accounts/1/limit", As: &admin, Body: map[string]any{"limit": nil}}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/open/accounts/1/limit", As: &admin, Body: map[string]any{"limit": 0}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/open/usage?days=7", As: &admin}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/open/summary", As: &admin}), http.StatusOK, 0)
}
