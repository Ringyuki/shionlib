package ai_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestScenesWithoutAUsableModelAreNotConfigured(t *testing.T) {
	f := newFixture(t)
	if _, err := f.gateway.Object(t.Context(), objectScene, objectRequest()); !errors.Is(err, ai.ErrSceneNotConfigured) {
		t.Fatalf("no model: %v", err)
	}
	if _, err := f.gateway.Object(t.Context(), "missing", objectRequest()); !errors.Is(err, ai.ErrSceneNotFound) {
		t.Fatalf("unknown scene: %v", err)
	}
	moderationModel := f.model(t, "omni-moderation", ai.Capabilities{Moderation: true})
	f.assign(t, objectScene, moderationModel)
	if _, err := f.gateway.Object(t.Context(), objectScene, objectRequest()); !errors.Is(err, ai.ErrSceneNotConfigured) {
		t.Fatalf("wrong output: %v", err)
	}
	chat := f.model(t, "chat", ai.Capabilities{Temperature: true})
	f.assign(t, objectScene, chat)
	if _, err := f.gateway.Object(t.Context(), objectScene, objectRequest()); !errors.Is(err, ai.ErrSceneNotConfigured) {
		t.Fatalf("no route: %v", err)
	}
}

func TestScenesFollowTheDefaultModel(t *testing.T) {
	f := newFixture(t)
	provider := f.provider(t, "alpha", ai.KindCompatible)
	model := f.model(t, "default", ai.Capabilities{Temperature: true})
	f.route(t, model, provider, ai.ProtocolChat, 0)
	if err := f.repo.UpdateModel(t.Context(), model, ai.ModelChanges{IsDefault: ptr(true)}); err != nil {
		t.Fatal(err)
	}
	result, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")})
	if err != nil {
		t.Fatal(err)
	}
	if result.Model != "upstream-"+itoa(model) {
		t.Fatalf("result %+v", result)
	}
}

func TestObjectsFailOverToTheNextRouteAndRecordEveryAttempt(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary, step{err: &ai.Failure{Kind: ai.ErrorUpstream, Message: "HTTP 502"}})
	f.upstream.script(setup.backup, step{completion: ai.Completion{Text: "```json\n{\"ok\": true}\n```", FinishReason: ai.FinishStop, Usage: ai.Usage{InputTokens: 1_000_000, OutputTokens: 500_000}, FirstToken: 30 * time.Millisecond}})
	result, err := f.gateway.Object(t.Context(), objectScene, objectRequest())
	if err != nil {
		t.Fatal(err)
	}
	if string(result.Output) != `{"ok":true}` || result.Model != "upstream-"+itoa(setup.modelID) {
		t.Fatalf("result %+v %s", result, result.Output)
	}
	records := f.requests.Records()
	if len(records) != 2 || records[0].OK || *records[0].ErrorKind != ai.ErrorUpstream || !records[1].OK || *records[1].RouteID != setup.backup {
		t.Fatalf("records %+v", records)
	}
	if records[0].CallID != records[1].CallID || records[1].CostUSD != 2 || *records[1].FirstTokenMS != 30 || *records[1].Scene != objectScene {
		t.Fatalf("attempt bookkeeping %+v", records[1])
	}
	detail := must(f.requests.GetRequest(t.Context(), records[1].ID))
	if detail.Payload == nil || detail.Payload.System != "system" || len(detail.Payload.Messages) != 1 || detail.Payload.Output == nil {
		t.Fatalf("payload %+v", detail.Payload)
	}
	if route := must(f.repo.GetRoute(t.Context(), setup.primary)); route.Status != ai.RouteActive {
		t.Fatalf("upstream errors do not suspend: %s", route.Status)
	}
}

func TestRepeatedFailuresCoolARouteDown(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	for range 3 {
		f.upstream.script(setup.primary, step{err: &ai.Failure{Kind: ai.ErrorRateLimit, Message: "HTTP 429"}})
		if _, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); err != nil {
			t.Fatal(err)
		}
	}
	before := len(f.upstream.calls())
	if _, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); err != nil {
		t.Fatal(err)
	}
	if calls := f.upstream.calls()[before:]; len(calls) != 1 || calls[0].Route.ID != setup.backup {
		t.Fatalf("a cooling route is tried last: %+v", calls)
	}
	f.clock.Advance(2 * time.Minute)
	before = len(f.upstream.calls())
	if _, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); err != nil {
		t.Fatal(err)
	}
	if calls := f.upstream.calls()[before:]; calls[0].Route.ID != setup.primary {
		t.Fatalf("the cooldown expires: %+v", calls)
	}
}

func TestAuthenticationFailuresSuspendTheRouteAndAnnounceIt(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary, step{err: &ai.Failure{Kind: ai.ErrorAuth, Message: "HTTP 401 · invalid api key"}})
	f.upstream.script(setup.backup, step{err: &ai.Failure{Kind: ai.ErrorQuota, Message: "HTTP 402"}})
	_, err := f.gateway.Object(t.Context(), objectScene, objectRequest())
	var failure *ai.Failure
	if !errors.Is(err, ai.ErrUnavailable) || !errors.As(err, &failure) || failure.Kind != ai.ErrorQuota {
		t.Fatalf("the last failure is reported: %v", err)
	}
	for _, id := range []int{setup.primary, setup.backup} {
		if route := must(f.repo.GetRoute(t.Context(), id)); route.Status != ai.RouteSuspended || route.StatusKind == nil {
			t.Fatalf("route %d %+v", id, route)
		}
	}
	if notices := f.queue.notices(); len(notices) != 2 || !notices[0].Suspended {
		t.Fatalf("notices %+v", notices)
	}
	if _, err := f.gateway.Object(t.Context(), objectScene, objectRequest()); !errors.Is(err, ai.ErrSceneNotConfigured) {
		t.Fatalf("suspended routes are not used: %v", err)
	}
}

func TestProtocolErrorsSwitchTheProtocolOfCompatibleRoutes(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary,
		step{err: &ai.Failure{Kind: ai.ErrorProtocol, Message: "HTTP 404"}},
		step{completion: ai.Completion{Text: `{"ok":true}`, FinishReason: ai.FinishStop}},
	)
	if _, err := f.gateway.Object(t.Context(), objectScene, objectRequest()); err != nil {
		t.Fatal(err)
	}
	calls := f.upstream.calls()
	if len(calls) != 2 || calls[0].Route.Protocol != ai.ProtocolChat || calls[1].Route.Protocol != ai.ProtocolResponses {
		t.Fatalf("calls %+v", calls)
	}
	route := must(f.repo.GetRoute(t.Context(), setup.primary))
	if route.Protocol != ai.ProtocolResponses || len(route.Adjustments) != 1 || route.Adjustments[0].Kind != ai.AdjustProtocol || *route.Adjustments[0].Previous != "chat" || route.Adjustments[0].RequestID == nil {
		t.Fatalf("the adaptation is saved: %+v", route)
	}
	if records := f.requests.Records(); *records[0].Adaptation != "protocol:responses" {
		t.Fatalf("the failed attempt names its adaptation: %+v", records[0])
	}
}

func TestParameterAndStructuredOutputErrorsAdaptTheRoute(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary,
		step{err: &ai.Failure{Kind: ai.ErrorParam, Param: ai.ParamTemperature, Message: "temperature unsupported"}},
		step{err: &ai.Failure{Kind: ai.ErrorStructured, Message: "response_format unsupported"}},
		step{completion: ai.Completion{Text: `{"ok":true}`, FinishReason: ai.FinishStop}},
	)
	request := objectRequest()
	request.Temperature = ptr(0.3)
	if _, err := f.gateway.Object(t.Context(), objectScene, request); err != nil {
		t.Fatal(err)
	}
	calls := f.upstream.calls()
	if len(calls) != 3 || !calls[2].Route.Drops(ai.ParamTemperature) || !calls[2].Route.JSONMode {
		t.Fatalf("calls %+v", calls)
	}
	route := must(f.repo.GetRoute(t.Context(), setup.primary))
	if !slices.Equal(route.DroppedParams, []string{ai.ParamTemperature}) || !route.JSONMode || len(route.Adjustments) != 2 {
		t.Fatalf("route %+v", route)
	}
}

func TestMalformedOutputFailsWithoutTryingOtherRoutes(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary, step{completion: ai.Completion{Text: "not json", FinishReason: ai.FinishLength}})
	_, err := f.gateway.Object(t.Context(), objectScene, objectRequest())
	var failure *ai.Failure
	if !errors.Is(err, ai.ErrOutputMalformed) || !errors.As(err, &failure) || failure.Kind != ai.ErrorTruncated {
		t.Fatalf("truncated output: %v", err)
	}
	if calls := f.upstream.calls(); len(calls) != 1 {
		t.Fatalf("no failover for output problems: %+v", calls)
	}
}

func TestSceneSettingsWinAndModelsWithoutTemperatureIgnoreIt(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	if err := f.repo.SaveSceneConfig(t.Context(), ai.SceneConfig{Key: textScene, ModelID: &setup.modelID, Temperature: ptr(0.1), MaxOutputTokens: ptr(64), Timeout: ptr(5 * time.Second)}); err != nil {
		t.Fatal(err)
	}
	request := ai.TextRequest{Prompt: ai.UserPrompt("", "hi"), Temperature: ptr(0.9), MaxOutputTokens: ptr(10)}
	if _, err := f.gateway.Text(t.Context(), textScene, request); err != nil {
		t.Fatal(err)
	}
	call := f.upstream.calls()[0]
	if *call.Temperature != 0.1 || *call.MaxOutputTokens != 64 || call.IdleTimeout != 5*time.Second {
		t.Fatalf("generation %+v", call)
	}
	if err := f.repo.UpdateModel(t.Context(), setup.modelID, ai.ModelChanges{Capabilities: &ai.Capabilities{OutputLimit: ptr(4000)}}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.gateway.Text(t.Context(), textScene, request); err != nil {
		t.Fatal(err)
	}
	if call := f.upstream.calls()[1]; call.Temperature != nil {
		t.Fatalf("temperature must be omitted: %+v", call)
	}
}

func TestMessagesRoutesDefaultToTheModelOutputLimit(t *testing.T) {
	f := newFixture(t)
	provider := f.provider(t, "claude", ai.KindAnthropic)
	model := f.model(t, "claude", ai.Capabilities{Temperature: true, OutputLimit: ptr(8192)})
	f.route(t, model, provider, ai.ProtocolMessages, 0)
	f.assign(t, textScene, model)
	if _, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); err != nil {
		t.Fatal(err)
	}
	if call := f.upstream.calls()[0]; call.MaxOutputTokens == nil || *call.MaxOutputTokens != 8192 {
		t.Fatalf("generation %+v", call)
	}
}

func TestTextStripsReasoningBlocks(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	f.upstream.script(setup.primary, step{completion: ai.Completion{Text: "<think>plan</think>\nAnswer", FinishReason: ai.FinishStop}})
	result, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")})
	if err != nil || result.Text != "Answer" {
		t.Fatalf("result %q %v", result.Text, err)
	}
}

func TestModerationUsesClassificationRoutes(t *testing.T) {
	f := newFixture(t)
	provider := f.provider(t, "openai", ai.KindOpenAI)
	model := f.model(t, "omni-moderation-latest", ai.Capabilities{Moderation: true})
	f.route(t, model, provider, ai.ProtocolModeration, 0)
	f.assign(t, moderationScene, model)
	f.upstream.classified = ai.Classified{Categories: []byte(`{"hate":false}`), Scores: []byte(`{"hate":0.1}`)}
	result, err := f.gateway.Moderate(t.Context(), moderationScene, ai.ModerationRequest{Input: "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if string(result.Scores) != `{"hate":0.1}` || result.Model != "upstream-"+itoa(model) {
		t.Fatalf("result %+v", result)
	}
	target := must(f.gateway.ModelTarget(t.Context(), model, ai.SourcePlayground))
	if _, err := f.gateway.RunObject(t.Context(), target, objectRequest()); !errors.Is(err, ai.ErrSceneModelMismatch) {
		t.Fatalf("moderation models cannot generate: %v", err)
	}
}

func TestInvalidSchemasAreRejected(t *testing.T) {
	f := newFixture(t)
	f.twoRoutes(t, objectScene)
	request := objectRequest()
	request.Schema = []byte(`[1]`)
	if _, err := f.gateway.Object(t.Context(), objectScene, request); !errors.Is(err, ai.ErrSchemaInvalid) {
		t.Fatalf("schema: %v", err)
	}
}

func TestCancelledCallsAreRecordedAndNotRetried(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	f.upstream.script(setup.primary, step{err: &ai.Failure{Kind: ai.ErrorOther, Message: "context canceled"}})
	if _, err := f.gateway.Text(ctx, textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled: %v", err)
	}
	if calls := f.upstream.calls(); len(calls) != 1 {
		t.Fatalf("no failover after cancellation: %+v", calls)
	}
	if records := f.requests.Records(); len(records) != 1 || records[0].OK {
		t.Fatalf("records %+v", records)
	}
}
