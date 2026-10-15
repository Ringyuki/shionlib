package aiwalkthrough_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aiwalkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const formatSchema = `{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"note":{"type":"array","items":{"type":"string"}},"routes":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"characters":{"type":"array","items":{"type":"integer"}},"requires":{"type":"array","items":{"type":"integer"}},"condition":{"type":"string"},"ending":{"type":"string"},"steps":{"type":"array","items":{"type":"string"}}},"required":["name","characters","requires","condition","ending","steps"],"additionalProperties":false}}},"required":["note","routes"],"additionalProperties":false}`

type gateway struct {
	scene     string
	object    ai.ObjectRequest
	output    ai.ObjectResult
	targetErr error
	err       error
}

func (g *gateway) SceneTarget(_ context.Context, key string, _ ai.Source) (ai.Target, error) {
	g.scene = key
	return ai.Target{}, g.targetErr
}

func (g *gateway) Object(_ context.Context, scene string, request ai.ObjectRequest) (ai.ObjectResult, error) {
	g.scene, g.object = scene, request
	return g.output, g.err
}

func newFormatter(t *testing.T, g *gateway) *aiwalkthrough.Formatter {
	t.Helper()
	formatter, err := aiwalkthrough.NewFormatter(g)
	if err != nil {
		t.Fatal(err)
	}
	return formatter
}

func TestTheSceneAsksForAnObject(t *testing.T) {
	if len(aiwalkthrough.Scenes) != 1 || aiwalkthrough.Scenes[0].Key != aiwalkthrough.FormatScene || aiwalkthrough.Scenes[0].Output != ai.OutputObject {
		t.Fatalf("scenes %+v", aiwalkthrough.Scenes)
	}
}

func TestReadyFollowsTheSceneConfiguration(t *testing.T) {
	g := &gateway{}
	if ready, err := newFormatter(t, g).Ready(t.Context()); err != nil || !ready || g.scene != aiwalkthrough.FormatScene {
		t.Fatalf("configured: %v %v %s", ready, err, g.scene)
	}
	g.targetErr = ai.ErrSceneNotConfigured.Wrap(errors.New("scene walkthrough_format has no model"))
	if ready, err := newFormatter(t, g).Ready(t.Context()); err != nil || ready {
		t.Fatalf("unconfigured: %v %v", ready, err)
	}
	g.targetErr = errors.New("database is down")
	if _, err := newFormatter(t, g).Ready(t.Context()); err == nil {
		t.Fatal("a failed lookup is an error")
	}
}

func TestFormatSendsTheCastAndTheSource(t *testing.T) {
	g := &gateway{output: ai.ObjectResult{Output: json.RawMessage(`{"note":[],"routes":[]}`)}}
	_, err := newFormatter(t, g).Format(t.Context(), walkthrough.FormatRequest{
		Text: "新谷 灯华\n◆ Save 01",
		Cast: []walkthrough.CastMember{{ID: 519, Names: []string{"新谷 灯華", "新谷 灯华"}}, {ID: 520, Names: []string{"日紫喜 うぐいす"}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if g.scene != aiwalkthrough.FormatScene || string(g.object.Schema) != formatSchema || g.object.SchemaName != "walkthroughFormat" {
		t.Fatalf("request %s %s %s", g.scene, g.object.Schema, g.object.SchemaName)
	}
	message := g.object.Messages[0].Content
	if !strings.Contains(g.object.System, "每个结局一条线路") || message != "角色表：\n519：新谷 灯華；新谷 灯华\n520：日紫喜 うぐいす\n\n攻略原文：\n新谷 灯华\n◆ Save 01" {
		t.Fatalf("prompt %q", message)
	}
}

func TestFormatReadsTheStepNotation(t *testing.T) {
	g := &gateway{output: ai.ObjectResult{Output: json.RawMessage(`{"note":["通关一次后即可直接进入"],"routes":[
		{"name":"","characters":[519],"requires":[],"condition":"","ending":"灯华 END","steps":["说不要去（行くなと言う） | 灯华","save 01","Load 1","# 【After篇】共通・灯华路线","","找点什么擦一下…… │ 雨音","A | B | 莺"]},
		{"name":"ハーレム","characters":[],"requires":[1,2,7,0],"condition":"全员通关后","ending":"","steps":["load 02"]}
	]}`)}}
	formatted, err := newFormatter(t, g).Format(t.Context(), walkthrough.FormatRequest{Text: "x"})
	if err != nil {
		t.Fatal(err)
	}
	want := walkthrough.Formatted{
		Note: []string{"通关一次后即可直接进入"},
		Routes: []walkthrough.Route{
			{Key: "r1", Characters: []int{519}, Requires: []string{}, Ending: "灯华 END", Steps: []walkthrough.Step{
				{Kind: walkthrough.StepChoice, Text: "说不要去（行くなと言う）", Remark: "灯华"},
				{Kind: walkthrough.StepSave, Slot: "01"},
				{Kind: walkthrough.StepLoad, Slot: "1"},
				{Kind: walkthrough.StepNote, Text: "【After篇】共通・灯华路线"},
				{Kind: walkthrough.StepGap},
				{Kind: walkthrough.StepChoice, Text: "找点什么擦一下……", Remark: "雨音"},
				{Kind: walkthrough.StepChoice, Text: "A | B", Remark: "莺"},
			}},
			{Key: "r2", Name: "ハーレム", Characters: []int{}, Requires: []string{"r1", "r2"}, Condition: "全员通关后", Steps: []walkthrough.Step{{Kind: walkthrough.StepLoad, Slot: "02"}}},
		},
	}
	if !reflect.DeepEqual(formatted, want) {
		t.Fatalf("formatted\n got %+v\nwant %+v", formatted, want)
	}
}

func TestFormatFailuresAreReturned(t *testing.T) {
	g := &gateway{err: ai.ErrUnavailable.Wrap(&ai.Failure{Kind: ai.ErrorUpstream, Message: "HTTP 502"})}
	if _, err := newFormatter(t, g).Format(t.Context(), walkthrough.FormatRequest{}); !errors.Is(err, ai.ErrUnavailable) {
		t.Fatalf("gateway: %v", err)
	}
	g = &gateway{output: ai.ObjectResult{Output: json.RawMessage(`{"routes":`)}}
	if _, err := newFormatter(t, g).Format(t.Context(), walkthrough.FormatRequest{}); err == nil {
		t.Fatal("malformed output is an error")
	}
}
