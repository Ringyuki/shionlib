package aimoderation_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aimoderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

const verdictSchema = `{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"decision":{"type":"string","enum":["ALLOW","BLOCK"]},"reason":{"type":"string","maxLength":2550},"evidence":{"type":"string","maxLength":1000},"top_category":{"type":"string","enum":["HARASSMENT","HARASSMENT_THREATENING","SEXUAL","SEXUAL_MINORS","HATE","HATE_THREATENING","ILLICIT","ILLICIT_VIOLENT","SELF_HARM","SELF_HARM_INTENT","SELF_HARM_INSTRUCTIONS","VIOLENCE","VIOLENCE_GRAPHIC","SPAM","MEANINGLESS"]},"categories_json":{"type":"object","properties":{},"additionalProperties":{"type":"boolean"},"required":[]}},"required":["decision","reason","evidence","top_category","categories_json"],"additionalProperties":false}`

type gateway struct {
	scene      string
	moderation ai.ModerationRequest
	object     ai.ObjectRequest
	moderated  ai.ModerationResult
	output     ai.ObjectResult
	err        error
}

func (g *gateway) Moderate(_ context.Context, scene string, request ai.ModerationRequest) (ai.ModerationResult, error) {
	g.scene, g.moderation = scene, request
	return g.moderated, g.err
}

func (g *gateway) Object(_ context.Context, scene string, request ai.ObjectRequest) (ai.ObjectResult, error) {
	g.scene, g.object = scene, request
	return g.output, g.err
}

func newClassifier(t *testing.T, g *gateway) *aimoderation.Classifier {
	t.Helper()
	classifier, err := aimoderation.NewClassifier(g)
	if err != nil {
		t.Fatal(err)
	}
	return classifier
}

func TestScenesCoverScreeningAndReview(t *testing.T) {
	if len(aimoderation.Scenes) != 2 || aimoderation.Scenes[0].Output != ai.OutputModeration || aimoderation.Scenes[1].Output != ai.OutputObject {
		t.Fatalf("scenes %+v", aimoderation.Scenes)
	}
}

func TestScreenUsesTheModerationScene(t *testing.T) {
	g := &gateway{moderated: ai.ModerationResult{Model: "omni-moderation-latest", Categories: json.RawMessage(`{"hate":false}`), Scores: json.RawMessage(`{"hate":0.2,"harassment":0.01}`)}}
	screening, err := newClassifier(t, g).Screen(t.Context(), "Hello World")
	if err != nil {
		t.Fatal(err)
	}
	if g.scene != aimoderation.ScreenScene || g.moderation.Input != "Hello World" {
		t.Fatalf("request %s %+v", g.scene, g.moderation)
	}
	if screening.Model != "omni-moderation-latest" || screening.CategoryScores["hate"] != 0.2 || string(screening.Categories) != `{"hate":false}` || string(screening.Scores) != `{"hate":0.2,"harassment":0.01}` {
		t.Fatalf("screening %+v", screening)
	}
}

func TestUnconfiguredScenesDisableModeration(t *testing.T) {
	g := &gateway{err: ai.ErrSceneNotConfigured.Wrap(errors.New("scene moderation_screen has no model"))}
	classifier := newClassifier(t, g)
	if _, err := classifier.Screen(t.Context(), "x"); !errors.Is(err, moderation.ErrClassifierDisabled) {
		t.Fatalf("screen: %v", err)
	}
	if _, err := classifier.Review(t.Context(), moderation.ReviewRequest{}); !errors.Is(err, moderation.ErrClassifierDisabled) {
		t.Fatalf("review: %v", err)
	}
}

func TestGatewayFailuresAreReturnedForRetry(t *testing.T) {
	g := &gateway{err: ai.ErrUnavailable.Wrap(&ai.Failure{Kind: ai.ErrorUpstream, Message: "HTTP 502"})}
	if _, err := newClassifier(t, g).Screen(t.Context(), "x"); !errors.Is(err, ai.ErrUnavailable) || errors.Is(err, moderation.ErrClassifierDisabled) {
		t.Fatalf("screen: %v", err)
	}
}

func TestReviewSendsTheVerdictSchemaAndParsesTheVerdict(t *testing.T) {
	g := &gateway{output: ai.ObjectResult{Model: "gpt-5-mini", Output: json.RawMessage(`{"decision":"BLOCK","reason":"` + strings.Repeat("r", 3000) + `","evidence":"quote","top_category":"SPAM","categories_json":{"SPAM":true}}`)}}
	verdict, err := newClassifier(t, g).Review(t.Context(), moderation.ReviewRequest{Instructions: "rules", Input: "content"})
	if err != nil {
		t.Fatal(err)
	}
	if g.scene != aimoderation.ReviewScene || string(g.object.Schema) != verdictSchema || g.object.SchemaName != "moderationEvent" ||
		g.object.System != "rules" || len(g.object.Messages) != 1 || g.object.Messages[0].Content != "content" {
		t.Fatalf("request %s %+v", g.scene, g.object)
	}
	if verdict.Model != "gpt-5-mini" || verdict.Decision != moderation.DecisionBlock || verdict.TopCategory != moderation.Category("SPAM") ||
		len([]rune(verdict.Reason)) != 2550 || verdict.Evidence != "quote" || string(verdict.Categories) != `{"SPAM":true}` {
		t.Fatalf("verdict %+v", verdict)
	}
}

func TestReviewRejectsUnknownDecisionsAndCategories(t *testing.T) {
	for _, output := range []string{
		`{"decision":"MAYBE","reason":"","evidence":"","top_category":"SPAM","categories_json":{}}`,
		`{"decision":"ALLOW","reason":"","evidence":"","top_category":"UNKNOWN","categories_json":{}}`,
		`{"decision":`,
	} {
		g := &gateway{output: ai.ObjectResult{Output: json.RawMessage(output)}}
		if _, err := newClassifier(t, g).Review(t.Context(), moderation.ReviewRequest{}); err == nil {
			t.Fatalf("expected an error for %s", output)
		}
	}
}
