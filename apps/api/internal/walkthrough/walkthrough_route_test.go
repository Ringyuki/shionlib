package walkthrough_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

func TestStepsSayWhatTheirKindNeeds(t *testing.T) {
	cases := []struct {
		step walkthrough.Step
		want bool
	}{
		{walkthrough.Step{Kind: walkthrough.StepChoice, Text: "左"}, true},
		{walkthrough.Step{Kind: walkthrough.StepChoice, Text: "  ", Remark: "x"}, false},
		{walkthrough.Step{Kind: walkthrough.StepNote, Text: "【START】"}, true},
		{walkthrough.Step{Kind: walkthrough.StepNote}, false},
		{walkthrough.Step{Kind: walkthrough.StepSave, Slot: "01"}, true},
		{walkthrough.Step{Kind: walkthrough.StepSave, Text: "01"}, false},
		{walkthrough.Step{Kind: walkthrough.StepLoad, Slot: "1"}, true},
		{walkthrough.Step{Kind: walkthrough.StepLoad}, false},
		{walkthrough.Step{Kind: walkthrough.StepGap}, true},
		{walkthrough.Step{Kind: "jump", Text: "x"}, false},
	}
	for _, c := range cases {
		if got := c.step.Valid(); got != c.want {
			t.Errorf("%+v: valid %v, want %v", c.step, got, c.want)
		}
	}
}

func TestTidyKeepsWhatARouteSays(t *testing.T) {
	tidy := walkthrough.Tidy([]walkthrough.Route{
		{
			Key:        "a",
			Name:       "  むぎ ",
			Characters: []int{7, 9, 7},
			Requires:   []string{"a", "b", "gone", "b"},
			Condition:  " 共通終了時 ",
			Ending:     " むぎEND\n",
			Steps: []walkthrough.Step{
				{Kind: walkthrough.StepGap},
				{Kind: walkthrough.StepNote, Text: " 【START】 ", Remark: "dropped", Slot: "9"},
				{Kind: walkthrough.StepGap},
				{Kind: walkthrough.StepGap},
				{Kind: walkthrough.StepChoice, Text: " 左 ", Remark: " むぎ＆緋華 ", Slot: "9"},
				{Kind: walkthrough.StepSave, Slot: " 01 ", Text: "dropped"},
				{Kind: walkthrough.StepGap},
			},
		},
		{Key: "b"},
	})
	want := []walkthrough.Route{
		{
			Key:        "a",
			Name:       "むぎ",
			Characters: []int{7, 9},
			Requires:   []string{"b"},
			Condition:  "共通終了時",
			Ending:     "むぎEND",
			Steps: []walkthrough.Step{
				{Kind: walkthrough.StepNote, Text: "【START】"},
				{Kind: walkthrough.StepGap},
				{Kind: walkthrough.StepChoice, Text: "左", Remark: "むぎ＆緋華"},
				{Kind: walkthrough.StepSave, Slot: "01"},
			},
		},
		{Key: "b", Characters: []int{}, Requires: []string{}, Steps: []walkthrough.Step{}},
	}
	if !reflect.DeepEqual(tidy, want) {
		t.Fatalf("tidy routes\n got %+v\nwant %+v", tidy, want)
	}
}

func TestPublishableNeedsSomethingToRead(t *testing.T) {
	step := []walkthrough.Step{{Kind: walkthrough.StepChoice, Text: "左"}}
	complete := walkthrough.Route{Key: "a", Name: "むぎ", Steps: step}
	cases := []struct {
		name    string
		hasNote bool
		routes  []walkthrough.Route
		want    error
	}{
		{"nothing written", false, nil, walkthrough.ErrEmpty},
		{"a note alone", true, nil, nil},
		{"a route alone", false, []walkthrough.Route{complete}, nil},
		{"a route without a name", true, []walkthrough.Route{complete, {Key: "b", Steps: step}}, walkthrough.ErrRouteIncomplete},
		{"a route without steps", false, []walkthrough.Route{{Key: "b", Name: "x"}}, walkthrough.ErrRouteIncomplete},
		{"a route of pauses only", false, []walkthrough.Route{{Key: "b", Name: "x", Steps: []walkthrough.Step{{Kind: walkthrough.StepGap}}}}, walkthrough.ErrRouteIncomplete},
	}
	for _, c := range cases {
		if got := walkthrough.Publishable(c.hasNote, c.routes); !errors.Is(got, c.want) || (c.want == nil && got != nil) {
			t.Errorf("%s: %v, want %v", c.name, got, c.want)
		}
	}
}

func TestTextHoldsEverythingWritten(t *testing.T) {
	text := walkthrough.Text("セーブ01まで", []walkthrough.Route{
		{
			Name:      "むぎ",
			Condition: "共通終了時",
			Ending:    "むぎEND",
			Steps: []walkthrough.Step{
				{Kind: walkthrough.StepNote, Text: "【START】"},
				{Kind: walkthrough.StepChoice, Text: "左", Remark: "むぎ＆緋華"},
				{Kind: walkthrough.StepSave, Slot: "01"},
				{Kind: walkthrough.StepGap},
			},
		},
		{Name: "ハーレム"},
	})
	if want := "セーブ01まで\nむぎ\n共通終了時\n【START】\n左\nむぎ＆緋華\nむぎEND\nハーレム"; text != want {
		t.Fatalf("text %q, want %q", text, want)
	}
	if walkthrough.Text("", nil) != "" {
		t.Fatal("nothing written has no text")
	}
}
