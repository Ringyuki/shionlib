package ai_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestScenesReportTheirEffectiveModelAndProblems(t *testing.T) {
	f := newFixture(t)
	f.stats.GroupedStats[ai.DimensionScene] = map[string]ai.Stats{objectScene: {Requests: 4, Failures: 1}}
	listed := must(f.scenes.List(t.Context()))
	if len(listed) != 3 || listed[0].Key != objectScene || *listed[0].Problem != ai.ProblemNoModel || listed[0].Stats.Requests != 4 {
		t.Fatalf("scenes %+v", listed)
	}
	setup := f.twoRoutes(t, objectScene)
	moderationModel := f.model(t, "omni-moderation-latest", ai.Capabilities{Moderation: true})
	if _, err := f.scenes.Update(t.Context(), objectScene, ai.SceneSettings{ModelID: &moderationModel}); !errors.Is(err, ai.ErrSceneModelMismatch) {
		t.Fatalf("mismatch: %v", err)
	}
	if _, err := f.scenes.Update(t.Context(), "missing", ai.SceneSettings{}); !errors.Is(err, ai.ErrSceneNotFound) {
		t.Fatalf("missing scene: %v", err)
	}
	if _, err := f.scenes.Update(t.Context(), objectScene, ai.SceneSettings{ModelID: ptr(999)}); !errors.Is(err, ai.ErrModelNotFound) {
		t.Fatalf("missing model: %v", err)
	}
	updated := must(f.scenes.Update(t.Context(), objectScene, ai.SceneSettings{ModelID: &setup.modelID, Temperature: ptr(0.2), Timeout: ptr(30 * time.Second)}))
	if updated.Problem != nil || updated.Model.ID != setup.modelID || updated.Effective.ID != setup.modelID || *updated.Timeout != 30*time.Second {
		t.Fatalf("updated %+v", updated)
	}
	if _, err := f.repo.SetRouteStatus(t.Context(), []int{setup.primary, setup.backup}, ai.RouteDisabled, f.clock.Now()); err != nil {
		t.Fatal(err)
	}
	listed = must(f.scenes.List(t.Context()))
	if *listed[0].Problem != ai.ProblemNoRoute {
		t.Fatalf("problem %+v", listed[0].Problem)
	}
	if err := f.repo.UpdateModel(t.Context(), moderationModel, ai.ModelChanges{IsDefault: ptr(true)}); err != nil {
		t.Fatal(err)
	}
	listed = must(f.scenes.List(t.Context()))
	if listed[1].Model != nil || listed[1].Effective.ID != moderationModel || *listed[1].Problem != ai.ProblemWrongOutput {
		t.Fatalf("the default model applies to unassigned scenes: %+v", listed[1])
	}
}
