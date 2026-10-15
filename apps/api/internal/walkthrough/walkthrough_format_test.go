package walkthrough_test

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

var cast = []walkthrough.CastMember{{ID: 519, Names: []string{"新谷 灯華", "新谷 灯华"}}, {ID: 520, Names: []string{"日紫喜 うぐいす", "日紫喜 莺"}}}

func TestCheckedKeepsOnlyWhatTheEditorAccepts(t *testing.T) {
	formatted := walkthrough.Checked(walkthrough.Formatted{
		Note: []string{" 通关一次【After篇】路线后，即可直接进入。 ", "", strings.Repeat("长", walkthrough.MaxNoteLength)},
		Routes: []walkthrough.Route{
			{Key: "r1", Characters: []int{519, 999, 519}, Ending: "灯华 END", Steps: []walkthrough.Step{
				{Kind: walkthrough.StepChoice, Text: " 说不要去（行くなと言う） ", Remark: "灯华"},
				{Kind: walkthrough.StepSave, Slot: "01"},
				{Kind: walkthrough.StepSave, Slot: "Save 02"},
				{Kind: walkthrough.StepLoad, Slot: "0001"},
				{Kind: walkthrough.StepNote, Text: "【After篇】共通・灯华路线"},
				{Kind: "jump", Text: "?"},
				{Kind: walkthrough.StepChoice, Text: strings.Repeat("长", walkthrough.MaxStepTextLength+1)},
				{Kind: walkthrough.StepChoice, Text: "尝试一下", Remark: strings.Repeat("长", walkthrough.MaxRemarkLength+1)},
			}},
			{Key: "r2", Name: strings.Repeat("长", walkthrough.MaxNameLength+1)},
			{Key: "r3", Name: "ハーレム", Requires: []string{"r1", "r2", "r3"}, Condition: "全员通关后", Steps: []walkthrough.Step{{Kind: walkthrough.StepLoad, Slot: "1"}}},
		},
	}, cast)
	want := walkthrough.Formatted{
		Note: []string{"通关一次【After篇】路线后，即可直接进入。"},
		Routes: []walkthrough.Route{
			{Key: "r1", Characters: []int{519}, Requires: []string{}, Ending: "灯华 END", Steps: []walkthrough.Step{
				{Kind: walkthrough.StepChoice, Text: "说不要去（行くなと言う）", Remark: "灯华"},
				{Kind: walkthrough.StepSave, Slot: "01"},
				{Kind: walkthrough.StepNote, Text: "【After篇】共通・灯华路线"},
				{Kind: walkthrough.StepChoice, Text: "尝试一下"},
			}},
			{Key: "r3", Name: "ハーレム", Characters: []int{}, Requires: []string{"r1"}, Condition: "全员通关后", Steps: []walkthrough.Step{{Kind: walkthrough.StepLoad, Slot: "1"}}},
		},
	}
	if !reflect.DeepEqual(formatted, want) {
		t.Fatalf("checked\n got %+v\nwant %+v", formatted, want)
	}
}

func TestCheckedCapsRoutesStepsAndCharacters(t *testing.T) {
	many := make([]walkthrough.Route, walkthrough.MaxRoutes+5)
	for i := range many {
		many[i] = walkthrough.Route{Key: "r" + strings.Repeat("1", i%9+1), Name: "线路"}
	}
	if routes := walkthrough.Checked(walkthrough.Formatted{Routes: many}, cast).Routes; len(routes) != walkthrough.MaxRoutes {
		t.Fatalf("routes %d", len(routes))
	}
	steps := make([]walkthrough.Step, walkthrough.MaxSteps+5)
	for i := range steps {
		steps[i] = walkthrough.Step{Kind: walkthrough.StepChoice, Text: "选项"}
	}
	characters := make([]int, 0, walkthrough.MaxCharacters+3)
	members := make([]walkthrough.CastMember, 0, walkthrough.MaxCharacters+3)
	for id := range walkthrough.MaxCharacters + 3 {
		characters = append(characters, id+1)
		members = append(members, walkthrough.CastMember{ID: id + 1})
	}
	route := walkthrough.Checked(walkthrough.Formatted{Routes: []walkthrough.Route{{Key: "r1", Characters: characters, Steps: steps}}}, members).Routes[0]
	if len(route.Steps) != walkthrough.MaxSteps || len(route.Characters) != walkthrough.MaxCharacters {
		t.Fatalf("steps %d characters %d", len(route.Steps), len(route.Characters))
	}
}

func TestFormatDayFollowsBeijingTime(t *testing.T) {
	cases := map[time.Time]string{
		time.Date(2026, 10, 15, 15, 59, 0, 0, time.UTC): "2026-10-15",
		time.Date(2026, 10, 15, 16, 0, 0, 0, time.UTC):  "2026-10-16",
	}
	for at, day := range cases {
		if got := walkthrough.FormatDay(at); got != day {
			t.Fatalf("%s: %s", at, got)
		}
	}
}

func TestFormatTaskIsAbandonedOnlyWhileWorkingTooLong(t *testing.T) {
	started := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	working := walkthrough.FormatTask{State: walkthrough.FormatWorking, Started: started}
	if working.Abandoned(started.Add(walkthrough.FormatGiveUpAfter)) || !working.Abandoned(started.Add(walkthrough.FormatGiveUpAfter+time.Second)) {
		t.Fatal("a working task is given up only after the limit")
	}
	done := walkthrough.FormatTask{State: walkthrough.FormatDone, Started: started}
	if done.Abandoned(started.Add(time.Hour)) {
		t.Fatal("a finished task is never abandoned")
	}
}
