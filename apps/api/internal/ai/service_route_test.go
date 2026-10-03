package ai_test

import (
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestRouteUpdatesValidateProtocolsAndStatus(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	if _, err := f.routes.Update(t.Context(), setup.primary, ai.RouteUpdate{Protocol: ptr(ai.ProtocolModeration)}); !errors.Is(err, ai.ErrProtocolUnsupported) {
		t.Fatalf("moderation on a chat model: %v", err)
	}
	if _, err := f.routes.Update(t.Context(), setup.primary, ai.RouteUpdate{Status: ptr(ai.RouteSuspended)}); err == nil {
		t.Fatal("routes cannot be suspended by hand")
	}
	view := must(f.routes.Update(t.Context(), setup.primary, ai.RouteUpdate{Protocol: ptr(ai.ProtocolResponses), InputPrice: ptr(5.0), Status: ptr(ai.RouteDisabled)}))
	if view.Protocol != ai.ProtocolResponses || view.Price.Input != 5 || view.Price.Output != 2 || view.Status != ai.RouteDisabled {
		t.Fatalf("view %+v", view)
	}
}

func TestAdjustmentsCanBeReverted(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary,
		step{err: &ai.Failure{Kind: ai.ErrorStructured, Message: "json_schema unsupported"}},
		step{completion: ai.Completion{Text: `{"ok":true}`, FinishReason: ai.FinishStop}},
	)
	if _, err := f.gateway.Object(t.Context(), objectScene, objectRequest()); err != nil {
		t.Fatal(err)
	}
	route := must(f.routes.Get(t.Context(), setup.primary))
	if !route.JSONMode || len(route.Adjustments) != 1 {
		t.Fatalf("route %+v", route)
	}
	if _, err := f.routes.RevertAdjustment(t.Context(), setup.primary, 999); !errors.Is(err, ai.ErrAdjustmentNotFound) {
		t.Fatalf("missing adjustment: %v", err)
	}
	reverted := must(f.routes.RevertAdjustment(t.Context(), setup.primary, route.Adjustments[0].ID))
	if reverted.JSONMode || len(reverted.Adjustments) != 0 {
		t.Fatalf("reverted %+v", reverted)
	}
}

func TestBatchActions(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	if count := must(f.routes.Batch(t.Context(), []int{setup.primary, setup.backup}, ai.BatchDisable)); count != 2 {
		t.Fatalf("disabled %d", count)
	}
	if _, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); !errors.Is(err, ai.ErrSceneNotConfigured) {
		t.Fatalf("disabled routes are not used: %v", err)
	}
	if count := must(f.routes.Batch(t.Context(), []int{setup.primary}, ai.BatchEnable)); count != 1 {
		t.Fatalf("enabled %d", count)
	}
	if count := must(f.routes.Batch(t.Context(), []int{setup.backup}, ai.BatchDelete)); count != 1 {
		t.Fatalf("deleted %d", count)
	}
	if err := f.routes.Delete(t.Context(), setup.backup); !errors.Is(err, ai.ErrRouteNotFound) {
		t.Fatalf("delete twice: %v", err)
	}
}
