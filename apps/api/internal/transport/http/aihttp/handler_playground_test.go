package aihttp_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type playgroundShape struct {
	Results []struct {
		OK     bool    `json:"ok"`
		Output *string `json:"output"`
		Error  *struct {
			Kind    string `json:"kind"`
			Message string `json:"message"`
		} `json:"error"`
		Attempts []struct {
			ID         string `json:"id"`
			CallID     string `json:"call_id"`
			Source     string `json:"source"`
			UpstreamID string `json:"upstream_id"`
			OK         bool   `json:"ok"`
		} `json:"attempts"`
	} `json:"results"`
}

func (f *fixture) playground(body map[string]any) playgroundShape {
	f.t.Helper()
	resp := f.do(http.MethodPost, "/admin/ai/playground/runs", &superAdmin, body)
	f.expect(resp, http.StatusOK, 0)
	var result playgroundShape
	f.decode(resp, &result)
	return result
}

func (f *fixture) playgroundModels() (gptRoute, gptModel, moderationModel int) {
	f.t.Helper()
	f.syncCatalog()
	provider := f.openAIProvider()
	routeIDs := f.addRoutes(provider, map[string]any{"upstream_id": "gpt-5-mini", "protocol": "responses"}, map[string]any{"upstream_id": "omni-moderation-latest", "protocol": "moderation"})
	return routeIDs[0], f.route(routeIDs[0]).Model.ID, f.route(routeIDs[1]).Model.ID
}

func TestPlaygroundRunsTextAndObjects(t *testing.T) {
	f := setup(t)
	route, model, _ := f.playgroundModels()
	messages := []map[string]any{{"role": "user", "content": "hi"}}
	f.expect(f.do(http.MethodPost, "/admin/ai/playground/runs", &admin, map[string]any{"targets": []map[string]any{{"kind": "model", "id": strconv.Itoa(model)}}, "messages": messages}), http.StatusForbidden, http.StatusForbidden)
	f.upstream.script(
		generated{completion: ai.Completion{Text: "<think>plan</think>hello there", FinishReason: ai.FinishStop}},
		generated{completion: ai.Completion{Text: "hello again", FinishReason: ai.FinishStop}},
	)
	text := f.playground(map[string]any{
		"targets":  []map[string]any{{"kind": "model", "id": strconv.Itoa(model)}, {"kind": "route", "id": strconv.Itoa(route)}},
		"system":   "be brief",
		"messages": messages,
	})
	if len(text.Results) != 2 || !text.Results[0].OK || text.Results[0].Output == nil || *text.Results[0].Output != "hello there" || *text.Results[1].Output != "hello again" {
		t.Fatalf("text %+v", text)
	}
	attempt := text.Results[0].Attempts
	if len(attempt) != 1 || attempt[0].ID != "1" || attempt[0].CallID != "call-1" || attempt[0].Source != "playground" || attempt[0].UpstreamID != "gpt-5-mini" || !attempt[0].OK {
		t.Fatalf("attempts %+v", attempt)
	}
	if generation := f.upstream.generated[0]; generation.Prompt.System != "be brief" || len(generation.Prompt.Messages) != 1 || generation.Schema != nil {
		t.Fatalf("generation %+v", generation)
	}
	f.upstream.script(generated{completion: ai.Completion{Text: "```json\n{\"answer\":1}\n```", FinishReason: ai.FinishStop}})
	object := f.playground(map[string]any{
		"targets":  []map[string]any{{"kind": "model", "id": strconv.Itoa(model)}},
		"messages": messages,
		"schema":   map[string]any{"type": "object", "properties": map[string]any{"answer": map[string]any{"type": "integer"}}},
	})
	if len(object.Results) != 1 || object.Results[0].Output == nil || *object.Results[0].Output != "{\n  \"answer\": 1\n}" {
		t.Fatalf("object %+v", object)
	}
	if schema := f.upstream.generated[len(f.upstream.generated)-1].Schema; !json.Valid(schema) || len(schema) == 0 {
		t.Fatalf("the schema reaches the upstream: %s", schema)
	}
}

func TestPlaygroundModerationAndFailures(t *testing.T) {
	f := setup(t)
	_, model, moderation := f.playgroundModels()
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+screenScene, &superAdmin, map[string]any{"model_id": moderation}), http.StatusOK, 0)
	f.upstream.classified = ai.Classified{Categories: json.RawMessage(`{"hate":false}`), Scores: json.RawMessage(`{"hate":0.1}`)}
	f.upstream.script(generated{err: &ai.Failure{Kind: ai.ErrorUpstream, Message: "HTTP 502"}})
	result := f.playground(map[string]any{
		"targets":  []map[string]any{{"kind": "scene", "id": screenScene}, {"kind": "model", "id": strconv.Itoa(model)}, {"kind": "scene", "id": reviewScene}},
		"messages": []map[string]any{{"role": "user", "content": "check this"}},
	})
	if len(result.Results) != 3 {
		t.Fatalf("results %+v", result)
	}
	screened := result.Results[0]
	if !screened.OK || screened.Output == nil || *screened.Output != "{\n  \"categories\": {\n    \"hate\": false\n  },\n  \"scores\": {\n    \"hate\": 0.1\n  }\n}" || len(screened.Attempts) != 1 || screened.Attempts[0].UpstreamID != "omni-moderation-latest" {
		t.Fatalf("moderation %+v", screened)
	}
	failed := result.Results[1]
	if failed.OK || failed.Output != nil || failed.Error == nil || failed.Error.Kind != "upstream" || failed.Error.Message != "HTTP 502" || len(failed.Attempts) != 1 || failed.Attempts[0].OK {
		t.Fatalf("failure %+v", failed)
	}
	unconfigured := result.Results[2]
	if unconfigured.OK || unconfigured.Error == nil || unconfigured.Error.Kind != "other" || len(unconfigured.Attempts) != 0 {
		t.Fatalf("unconfigured scene %+v", unconfigured)
	}
}

func TestPlaygroundValidation(t *testing.T) {
	f := setup(t)
	_, model, _ := f.playgroundModels()
	messages := []map[string]any{{"role": "user", "content": "hi"}}
	run := func(target map[string]any, extra map[string]any) map[string]any {
		body := map[string]any{"targets": []map[string]any{target}, "messages": messages}
		for key, value := range extra {
			body[key] = value
		}
		return body
	}
	f.expect(f.do(http.MethodPost, "/admin/ai/playground/runs", &superAdmin, run(map[string]any{"kind": "scene", "id": "unknown"}, nil)), http.StatusNotFound, 630122)
	f.expect(f.do(http.MethodPost, "/admin/ai/playground/runs", &superAdmin, run(map[string]any{"kind": "model", "id": "abc"}, nil)), http.StatusNotFound, 630122)
	f.expect(f.do(http.MethodPost, "/admin/ai/playground/runs", &superAdmin, run(map[string]any{"kind": "model", "id": strconv.Itoa(model)}, map[string]any{"schema": []int{1}})), http.StatusUnprocessableEntity, 630121)
	f.expect(f.do(http.MethodPost, "/admin/ai/playground/runs", &superAdmin, map[string]any{"targets": []map[string]any{{"kind": "model", "id": strconv.Itoa(model)}}, "messages": []any{}}), http.StatusUnprocessableEntity, 100101)
	f.expect(f.do(http.MethodPost, "/admin/ai/playground/runs", &superAdmin, run(map[string]any{"kind": "provider", "id": "1"}, nil)), http.StatusUnprocessableEntity, 100101)
	missing := f.playground(run(map[string]any{"kind": "model", "id": fmt.Sprint(model + 100)}, nil))
	if len(missing.Results) != 1 || missing.Results[0].OK || missing.Results[0].Error == nil {
		t.Fatalf("a missing model is reported per target: %+v", missing)
	}
}
