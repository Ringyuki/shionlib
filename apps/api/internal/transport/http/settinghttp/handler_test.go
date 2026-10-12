package settinghttp_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/settinghttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var maxConns = setting.Int(setting.Spec[int]{Name: "fixture.max_conns", Label: "连接数", Default: 8, Min: 1, Max: 64})

var apiSecret = setting.Secret(setting.Spec[string]{Name: "fixture.api_secret", Label: "密钥", MaxLength: 64})

var (
	member     = actor.Actor{UserID: 1, Role: actor.RoleUser}
	admin      = actor.Actor{UserID: 2, Role: actor.RoleAdmin}
	superAdmin = actor.Actor{UserID: 3, Role: actor.RoleSuperAdmin}
)

type settingShape struct {
	Name       string          `json:"name"`
	Group      string          `json:"group"`
	Kind       string          `json:"kind"`
	Label      string          `json:"label"`
	Value      json.RawMessage `json:"value"`
	Default    json.RawMessage `json:"default"`
	Min        json.RawMessage `json:"min"`
	Max        json.RawMessage `json:"max"`
	Overridden bool            `json:"overridden"`
	LastChange *changeShape    `json:"last_change"`
}

type changeShape struct {
	Previous json.RawMessage `json:"previous"`
	Value    json.RawMessage `json:"value"`
	Editor   *struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"editor"`
}

type env struct {
	server    *apitest.Server
	service   *setting.Service
	announcer *settingtest.Announcer
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	repo := settingtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.AddEditor(superAdmin.UserID, "shion")
	announcer := &settingtest.Announcer{}
	service := setting.NewService(setting.Deps{Repo: repo, Tx: &txtest.Immediate{}, Announcer: announcer})
	settinghttp.NewHandler(service, server.Builder).Register(server.API)
	return env{server: server, service: service, announcer: announcer}
}

func (e env) list(t *testing.T) map[string]settingShape {
	t.Helper()
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/settings", As: &admin})
	e.server.Expect(resp, http.StatusOK, 0)
	var list []settingShape
	resp.Decode(t, &list)
	byName := map[string]settingShape{}
	for _, entry := range list {
		byName[entry.Name] = entry
	}
	return byName
}

func TestListShowsDefaultsAndBoundsToAdmins(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/settings"}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/settings", As: &member}), http.StatusForbidden, http.StatusForbidden)
	settings := e.list(t)
	register := settings["user.allow_register"]
	if register.Kind != "flag" || register.Group != "user" || register.Label != "开放注册" || string(register.Value) != "true" || string(register.Default) != "true" || register.Overridden || register.LastChange != nil || register.Min != nil {
		t.Fatalf("allow register: %+v", register)
	}
	if len(settings) != len(setting.Definitions()) {
		t.Fatalf("every declared key is listed: %d of %d", len(settings), len(setting.Definitions()))
	}
}

func TestSuperAdminsChangeAndResetSettings(t *testing.T) {
	e := setup(t)
	path := "/admin/settings/user.allow_register"
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &admin, Body: map[string]any{"value": false}}), http.StatusForbidden, http.StatusForbidden)
	resp := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &superAdmin, Body: map[string]any{"value": false}})
	e.server.Expect(resp, http.StatusOK, 0)
	var changed settingShape
	resp.Decode(t, &changed)
	if string(changed.Value) != "false" || !changed.Overridden || changed.LastChange == nil || changed.LastChange.Editor == nil || changed.LastChange.Editor.Name != "shion" || string(changed.LastChange.Previous) != "null" || string(changed.LastChange.Value) != "false" {
		t.Fatalf("changed: %s", resp.Data)
	}
	public := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/settings/public"})
	e.server.Expect(public, http.StatusOK, 0)
	if string(public.Data) != `{"allow_register":false,"sponsor_enabled":false}` {
		t.Fatalf("public settings: %s", public.Data)
	}
	reset := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &superAdmin})
	e.server.Expect(reset, http.StatusOK, 0)
	var restored settingShape
	reset.Decode(t, &restored)
	if string(restored.Value) != "true" || restored.Overridden || restored.LastChange == nil || string(restored.LastChange.Value) != "null" || string(restored.LastChange.Previous) != "false" {
		t.Fatalf("restored: %s", reset.Data)
	}
	if e.announcer.Calls() != 2 {
		t.Fatalf("every change is announced: %d", e.announcer.Calls())
	}
	history := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "/history?page=1&pageSize=1", As: &admin})
	e.server.Expect(history, http.StatusOK, 0)
	var page struct {
		Items []changeShape `json:"items"`
		Meta  struct {
			TotalItems int `json:"totalItems"`
		} `json:"meta"`
	}
	history.Decode(t, &page)
	if len(page.Items) != 1 || string(page.Items[0].Previous) != "false" || page.Meta.TotalItems != 2 {
		t.Fatalf("history: %s", history.Data)
	}
}

func TestSecretsAreWrittenButNeverReturned(t *testing.T) {
	e := setup(t)
	path := "/admin/settings/fixture.api_secret"
	resp := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &superAdmin, Body: map[string]any{"value": "hunter2"}})
	e.server.Expect(resp, http.StatusOK, 0)
	var changed settingShape
	resp.Decode(t, &changed)
	if changed.Kind != "secret" || string(changed.Value) != `""` || !changed.Overridden || strings.Contains(string(resp.Data), "hunter2") {
		t.Fatalf("changed: %s", resp.Data)
	}
	if apiSecret.Read(e.service) != "hunter2" {
		t.Fatalf("the secret is served to the application: %q", apiSecret.Read(e.service))
	}
	for _, read := range []string{"/admin/settings", path + "/history?page=1&pageSize=10"} {
		listed := e.server.Do(apitest.Request{Method: http.MethodGet, Path: read, As: &admin})
		e.server.Expect(listed, http.StatusOK, 0)
		if strings.Contains(string(listed.Data), "hunter2") {
			t.Fatalf("%s leaks the secret: %s", read, listed.Data)
		}
	}
	cleared := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &superAdmin, Body: map[string]any{"value": ""}})
	e.server.Expect(cleared, http.StatusOK, 0)
	var restored settingShape
	cleared.Decode(t, &restored)
	if restored.Overridden || apiSecret.Read(e.service) != "" {
		t.Fatalf("an empty value clears the secret: %s", cleared.Data)
	}
}

func TestChangesAreValidated(t *testing.T) {
	e := setup(t)
	patch := func(path string, body any) apitest.Response {
		return e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &superAdmin, Body: body})
	}
	e.server.Expect(patch("/admin/settings/"+maxConns.Name(), map[string]any{"value": 100}), http.StatusBadRequest, 640102)
	e.server.Expect(patch("/admin/settings/"+maxConns.Name(), map[string]any{"value": "4"}), http.StatusBadRequest, 640102)
	e.server.Expect(patch("/admin/settings/fixture.unknown", map[string]any{"value": 4}), http.StatusNotFound, 640101)
	e.server.Expect(patch("/admin/settings/Fixture", map[string]any{"value": 4}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/settings/fixture.unknown/history", As: &admin}), http.StatusNotFound, 640101)
	if e.announcer.Calls() != 0 {
		t.Fatalf("rejected changes are not announced: %d", e.announcer.Calls())
	}
}
