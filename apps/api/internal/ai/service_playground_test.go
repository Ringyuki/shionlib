package ai_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestPlaygroundRunsEveryTarget(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, objectScene)
	f.upstream.script(setup.primary, step{completion: ai.Completion{Text: "plain answer", FinishReason: ai.FinishStop}})
	run := ai.PlaygroundRun{
		Targets: []ai.PlaygroundTarget{{Kind: ai.PlaygroundScene, ID: objectScene}, {Kind: ai.PlaygroundRoute, ID: itoa(setup.backup)}, {Kind: ai.PlaygroundScene, ID: moderationScene}},
		Prompt:  ai.UserPrompt("system", "hello"),
	}
	results := must(f.playground.Run(t.Context(), run))
	if len(results) != 3 || !results[0].OK || *results[0].Output != "plain answer" || !results[1].OK || len(results[1].Attempts) != 1 || results[1].Attempts[0].Source != ai.SourcePlayground {
		t.Fatalf("results %+v", results)
	}
	if results[2].OK || results[2].Failure == nil || len(results[2].Attempts) != 0 {
		t.Fatalf("an unconfigured scene is reported per target: %+v", results[2])
	}
	run.Schema = objectSchema
	run.Targets = run.Targets[:1]
	structured := must(f.playground.Run(t.Context(), run))
	if !strings.Contains(*structured[0].Output, "\"ok\": true") {
		t.Fatalf("structured %+v", *structured[0].Output)
	}
}

func TestPlaygroundRejectsUnknownTargetsAndSchemas(t *testing.T) {
	f := newFixture(t)
	if _, err := f.playground.Run(t.Context(), ai.PlaygroundRun{Targets: []ai.PlaygroundTarget{{Kind: ai.PlaygroundScene, ID: "missing"}}}); !errors.Is(err, ai.ErrPlaygroundTarget) {
		t.Fatalf("scene: %v", err)
	}
	if _, err := f.playground.Run(t.Context(), ai.PlaygroundRun{Targets: []ai.PlaygroundTarget{{Kind: ai.PlaygroundModel, ID: "x"}}}); !errors.Is(err, ai.ErrPlaygroundTarget) {
		t.Fatalf("model id: %v", err)
	}
	if _, err := f.playground.Run(t.Context(), ai.PlaygroundRun{Targets: []ai.PlaygroundTarget{{Kind: ai.PlaygroundScene, ID: objectScene}}, Schema: []byte(`"x"`)}); !errors.Is(err, ai.ErrSchemaInvalid) {
		t.Fatalf("schema: %v", err)
	}
	results := must(f.playground.Run(t.Context(), ai.PlaygroundRun{Targets: []ai.PlaygroundTarget{{Kind: ai.PlaygroundModel, ID: "999"}}, Prompt: ai.UserPrompt("", "hi")}))
	if results[0].OK || results[0].Failure == nil {
		t.Fatalf("a missing model is a failed target: %+v", results)
	}
}
