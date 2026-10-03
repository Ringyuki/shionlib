package ai_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestChecksRecoverSuspendedRoutes(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	if _, err := f.repo.SuspendRoute(t.Context(), setup.primary, ai.Failure{Kind: ai.ErrorAuth, Message: "HTTP 401"}, f.clock.Now()); err != nil {
		t.Fatal(err)
	}
	f.upstream.script(setup.primary, step{err: &ai.Failure{Kind: ai.ErrorAuth, Message: "HTTP 401"}})
	result := must(f.routes.Check(t.Context(), setup.primary))
	if result.Failure == nil || result.Failure.Kind != ai.ErrorAuth || result.Route.Status != ai.RouteSuspended {
		t.Fatalf("still failing: %+v", result)
	}
	if err := f.probe.ProbeSuspended(t.Context()); err != nil {
		t.Fatal(err)
	}
	if route := must(f.repo.GetRoute(t.Context(), setup.primary)); route.Status != ai.RouteActive {
		t.Fatalf("a passing probe recovers the route: %+v", route)
	}
	notices := f.queue.notices()
	if len(notices) != 1 || notices[0].Suspended || notices[0].RouteID != setup.primary {
		t.Fatalf("notices %+v", notices)
	}
	records := f.requests.Records()
	if len(records) != 2 || records[0].Source != ai.SourceCheck {
		t.Fatalf("checks are recorded as checks: %+v", records)
	}
}

func TestModerationRoutesAreCheckedWithAClassification(t *testing.T) {
	f := newFixture(t)
	provider := f.provider(t, "openai", ai.KindOpenAI)
	model := f.model(t, "omni-moderation-latest", ai.Capabilities{Moderation: true})
	route := f.route(t, model, provider, ai.ProtocolModeration, 0)
	f.upstream.classified = ai.Classified{Categories: []byte(`{}`), Scores: []byte(`{}`)}
	if failure := must(f.probe.Check(t.Context(), route)); failure != nil {
		t.Fatalf("failure %+v", failure)
	}
	if calls := f.upstream.calls(); len(calls) != 0 {
		t.Fatalf("no generation for moderation routes: %+v", calls)
	}
}
