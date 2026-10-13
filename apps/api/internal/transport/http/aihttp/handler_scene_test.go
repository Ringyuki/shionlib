package aihttp_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type sceneShape struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Output string `json:"output"`
	Model  *struct {
		ID int `json:"id"`
	} `json:"model"`
	Effective *struct {
		ID         int  `json:"id"`
		Moderation bool `json:"moderation"`
	} `json:"effective"`
	Temperature *float64 `json:"temperature"`
	TimeoutMS   *int     `json:"timeout_ms"`
	Problem     *string  `json:"problem"`
	Stats       struct {
		Requests int `json:"requests"`
	} `json:"stats"`
}

func (f *fixture) scenes() map[string]sceneShape {
	f.t.Helper()
	resp := f.do(http.MethodGet, "/admin/ai/scenes", &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	var list []sceneShape
	f.decode(resp, &list)
	byKey := map[string]sceneShape{}
	for _, scene := range list {
		byKey[scene.Key] = scene
	}
	return byKey
}

func TestScenesStartWithoutModels(t *testing.T) {
	f := setup(t)
	f.stats.GroupedStats[ai.DimensionScene] = map[string]ai.Stats{reviewScene: {Requests: 5}}
	scenes := f.scenes()
	screen, review := scenes[screenScene], scenes[reviewScene]
	if len(scenes) != 2 || screen.Output != "moderation" || screen.Label != "内容审核初筛" || screen.Problem == nil || *screen.Problem != "no_model" || screen.Model != nil || screen.Effective != nil {
		t.Fatalf("screen %+v", screen)
	}
	if review.Output != "object" || review.Problem == nil || *review.Problem != "no_model" || review.Stats.Requests != 5 {
		t.Fatalf("review %+v", review)
	}
}

func TestSceneUpdate(t *testing.T) {
	f := setup(t)
	f.syncCatalog()
	provider := f.openAIProvider()
	routeIDs := f.addRoutes(provider, map[string]any{"upstream_id": "gpt-5-mini", "protocol": "responses"}, map[string]any{"upstream_id": "omni-moderation-latest", "protocol": "moderation"})
	gpt, moderation := f.route(routeIDs[0]).Model.ID, f.route(routeIDs[1]).Model.ID
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+screenScene, &admin, map[string]any{"model_id": moderation}), http.StatusForbidden, http.StatusForbidden)
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+screenScene, &superAdmin, map[string]any{"model_id": gpt}), http.StatusUnprocessableEntity, 630112)
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+reviewScene, &superAdmin, map[string]any{"model_id": moderation}), http.StatusUnprocessableEntity, 630112)
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/unknown", &superAdmin, map[string]any{}), http.StatusNotFound, 630111)
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+screenScene, &superAdmin, map[string]any{"model_id": 99}), http.StatusNotFound, 630104)
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+screenScene, &superAdmin, map[string]any{"timeout_ms": 10}), http.StatusUnprocessableEntity, 100101)
	resp := f.do(http.MethodPut, "/admin/ai/scenes/"+screenScene, &superAdmin, map[string]any{"model_id": moderation, "timeout_ms": 30000})
	f.expect(resp, http.StatusOK, 0)
	var screen sceneShape
	f.decode(resp, &screen)
	if screen.Problem != nil || screen.Model == nil || screen.Model.ID != moderation || screen.Effective == nil || !screen.Effective.Moderation || screen.TimeoutMS == nil || *screen.TimeoutMS != 30000 {
		t.Fatalf("screen %s", resp.Data)
	}
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/models/%d", gpt), &superAdmin, map[string]any{"is_default": true}), http.StatusOK, 0)
	review := f.scenes()[reviewScene]
	if review.Problem != nil || review.Model != nil || review.Effective == nil || review.Effective.ID != gpt {
		t.Fatalf("the review scene follows the default model: %+v", review)
	}
	f.expect(f.do(http.MethodPut, "/admin/ai/scenes/"+reviewScene, &superAdmin, map[string]any{"model_id": gpt, "temperature": 0.2}), http.StatusOK, 0)
	if review = f.scenes()[reviewScene]; review.Model == nil || review.Temperature == nil || *review.Temperature != 0.2 {
		t.Fatalf("review %+v", review)
	}
	f.expect(f.do(http.MethodPost, "/admin/ai/routes/batch", &superAdmin, map[string]any{"ids": []int{routeIDs[1]}, "action": "disable"}), http.StatusOK, 0)
	if screen = f.scenes()[screenScene]; screen.Problem == nil || *screen.Problem != "no_route" {
		t.Fatalf("a scene without active routes reports it: %+v", screen)
	}
}
