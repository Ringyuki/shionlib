package aihttp_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func (f *fixture) gptRoute() int {
	f.t.Helper()
	f.syncCatalog()
	id := f.openAIProvider()
	return f.addRoutes(id, map[string]any{"upstream_id": "gpt-5-mini", "protocol": "responses"})[0]
}

func TestRouteUpdate(t *testing.T) {
	f := setup(t)
	id := f.gptRoute()
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/routes/%d", id), &admin, map[string]any{"status": "disabled"}), http.StatusForbidden, http.StatusForbidden)
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/routes/%d", id), &superAdmin, map[string]any{"protocol": "chat"}), http.StatusUnprocessableEntity, 630109)
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/routes/%d", id), &superAdmin, map[string]any{"protocol": "moderation"}), http.StatusUnprocessableEntity, 630109)
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/routes/%d", id), &superAdmin, map[string]any{"status": "suspended"}), http.StatusUnprocessableEntity, 100101)
	resp := f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/routes/%d", id), &superAdmin, map[string]any{"status": "disabled", "upstream_id": "gpt-5-mini-2026", "price_manual": true, "input_price": 9})
	f.expect(resp, http.StatusOK, 0)
	var route routeShape
	f.decode(resp, &route)
	if route.Status != "disabled" || route.UpstreamID != "gpt-5-mini-2026" || route.InputPrice != 9 {
		t.Fatalf("route %s", resp.Data)
	}
	f.expect(f.do(http.MethodPatch, "/admin/ai/routes/99", &superAdmin, map[string]any{"status": "active"}), http.StatusNotFound, 630107)
}

func TestRouteBatchAndDelete(t *testing.T) {
	f := setup(t)
	id := f.gptRoute()
	disabled := f.do(http.MethodPost, "/admin/ai/routes/batch", &superAdmin, map[string]any{"ids": []int{id, 99}, "action": "disable"})
	f.expect(disabled, http.StatusOK, 0)
	if string(disabled.Data) != `{"count":1}` || f.route(id).Status != "disabled" {
		t.Fatalf("disable %s", disabled.Data)
	}
	f.expect(f.do(http.MethodPost, "/admin/ai/routes/batch", &superAdmin, map[string]any{"ids": []int{id}, "action": "enable"}), http.StatusOK, 0)
	if f.route(id).Status != "active" {
		t.Fatal("enabled again")
	}
	f.expect(f.do(http.MethodPost, "/admin/ai/routes/batch", &superAdmin, map[string]any{"ids": []int{id}, "action": "archive"}), http.StatusUnprocessableEntity, 100101)
	deleted := f.do(http.MethodPost, "/admin/ai/routes/batch", &superAdmin, map[string]any{"ids": []int{id}, "action": "delete"})
	f.expect(deleted, http.StatusOK, 0)
	if string(deleted.Data) != `{"count":1}` {
		t.Fatalf("delete %s", deleted.Data)
	}
	f.expect(f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/routes/%d", id), &superAdmin, nil), http.StatusNotFound, 630107)
}

func TestRouteCheckRecordsTheAttempt(t *testing.T) {
	f := setup(t)
	id := f.gptRoute()
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", id), &admin, nil), http.StatusForbidden, http.StatusForbidden)
	resp := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", id), &superAdmin, nil)
	f.expect(resp, http.StatusOK, 0)
	var check struct {
		OK    bool       `json:"ok"`
		Error *struct{}  `json:"error"`
		Route routeShape `json:"route"`
	}
	f.decode(resp, &check)
	if !check.OK || check.Error != nil || check.Route.ID != id || check.Route.Status != "active" {
		t.Fatalf("check %s", resp.Data)
	}
	records := f.requests.Records()
	if len(records) != 1 || records[0].Source != ai.SourceCheck || !records[0].OK || records[0].RouteID == nil || *records[0].RouteID != id {
		t.Fatalf("records %+v", records)
	}
	if len(f.queue.notices()) != 0 {
		t.Fatalf("a healthy route announces nothing: %+v", f.queue.notices())
	}
}

func TestRouteCheckSuspendsOnAuthFailuresAndRecovers(t *testing.T) {
	f := setup(t)
	id := f.gptRoute()
	f.upstream.script(generated{err: &ai.Failure{Kind: ai.ErrorAuth, Message: "HTTP 401 · invalid api key"}})
	resp := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", id), &superAdmin, nil)
	f.expect(resp, http.StatusOK, 0)
	var failed struct {
		OK    bool `json:"ok"`
		Error *struct {
			Kind    string `json:"kind"`
			Message string `json:"message"`
		} `json:"error"`
		Route routeShape `json:"route"`
	}
	f.decode(resp, &failed)
	if failed.OK || failed.Error == nil || failed.Error.Kind != "auth" || failed.Error.Message != "HTTP 401 · invalid api key" ||
		failed.Route.Status != "suspended" || failed.Route.StatusKind == nil || *failed.Route.StatusKind != "auth" {
		t.Fatalf("failed check %s", resp.Data)
	}
	if notices := f.queue.notices(); len(notices) != 1 || notices[0] != (ai.RouteStatusNotice{RouteID: id, Suspended: true}) {
		t.Fatalf("suspension notice %+v", notices)
	}
	recovered := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", id), &superAdmin, nil)
	f.expect(recovered, http.StatusOK, 0)
	if !strings.Contains(string(recovered.Data), `"ok":true`) || f.route(id).Status != "active" {
		t.Fatalf("recovery %s", recovered.Data)
	}
	if notices := f.queue.notices(); len(notices) != 2 || notices[1] != (ai.RouteStatusNotice{RouteID: id, Suspended: false}) {
		t.Fatalf("recovery notice %+v", notices)
	}
}

func TestRouteAdjustmentsCanBeReverted(t *testing.T) {
	f := setup(t)
	id := f.gptRoute()
	f.expect(f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/routes/%d/adjustments/99", id), &superAdmin, nil), http.StatusNotFound, 630114)
	f.upstream.script(generated{err: &ai.Failure{Kind: ai.ErrorParam, Param: ai.ParamTemperature, Message: "HTTP 400 · temperature is not supported"}})
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", id), &superAdmin, nil), http.StatusOK, 0)
	adapted := f.do(http.MethodGet, fmt.Sprintf("/admin/ai/routes/%d", id), &admin, nil)
	f.expect(adapted, http.StatusOK, 0)
	var route struct {
		DroppedParams []string `json:"dropped_params"`
		Adjustments   []struct {
			ID        int     `json:"id"`
			Kind      string  `json:"kind"`
			Value     string  `json:"value"`
			ErrorKind string  `json:"error_kind"`
			RequestID *string `json:"request_id"`
		} `json:"adjustments"`
	}
	f.decode(adapted, &route)
	if len(route.DroppedParams) != 1 || route.DroppedParams[0] != "temperature" || len(route.Adjustments) != 1 ||
		route.Adjustments[0].Kind != "param" || route.Adjustments[0].Value != "temperature" || route.Adjustments[0].ErrorKind != "param" || route.Adjustments[0].RequestID == nil || *route.Adjustments[0].RequestID != "1" {
		t.Fatalf("adapted route %s", adapted.Data)
	}
	reverted := f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/routes/%d/adjustments/%d", id, route.Adjustments[0].ID), &superAdmin, nil)
	f.expect(reverted, http.StatusOK, 0)
	if !strings.Contains(string(reverted.Data), `"dropped_params":[]`) || !strings.Contains(string(reverted.Data), `"adjustments":[]`) {
		t.Fatalf("reverted %s", reverted.Data)
	}
}
