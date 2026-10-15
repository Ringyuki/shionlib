package walkthrough

import (
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	MaxNameLength      = 80
	MaxConditionLength = 300
	MaxEndingLength    = 100
	MaxStepTextLength  = 300
	MaxRemarkLength    = 100
	MaxCharacters      = 12
	MaxRoutes          = 60
	MaxSteps           = 500
	MaxSlotDigits      = 3
)

const (
	FormatQueue       = "walkthrough_format"
	FormatConcurrency = 4
	FormatTaskTTL     = time.Hour
	FormatGiveUpAfter = 12 * time.Minute
	FormatDayOffset   = 8 * time.Hour
	formatAttempts    = 1
)

type CastMember struct {
	ID    int
	Names []string
}

type FormatRequest struct {
	Text string
	Cast []CastMember
}

type Formatted struct {
	Note   []string
	Routes []Route
}

type FormatState string

const (
	FormatWorking FormatState = "working"
	FormatDone    FormatState = "done"
	FormatFailed  FormatState = "failed"
)

type FormatTask struct {
	ID      string
	OwnerID int
	GameID  int
	Text    string
	State   FormatState
	Started time.Time
	Result  Formatted
	Failure string
}

func (t FormatTask) Abandoned(now time.Time) bool {
	return t.State == FormatWorking && now.Sub(t.Started) > FormatGiveUpAfter
}

func FormatDay(now time.Time) string {
	return now.UTC().Add(FormatDayOffset).Format(time.DateOnly)
}

func Checked(formatted Formatted, cast []CastMember) Formatted {
	members := make(map[int]bool, len(cast))
	for _, member := range cast {
		members[member.ID] = true
	}
	routes := make([]Route, 0, min(len(formatted.Routes), MaxRoutes))
	for _, route := range formatted.Routes {
		checked := checkedRoute(route, members)
		if checked.Name == "" && len(checked.Characters) == 0 && len(checked.Steps) == 0 {
			continue
		}
		routes = append(routes, checked)
		if len(routes) == MaxRoutes {
			break
		}
	}
	return Formatted{Note: notePart(formatted.Note), Routes: Tidy(routes)}
}

func checkedRoute(route Route, members map[int]bool) Route {
	characters := slices.DeleteFunc(slices.Clone(route.Characters), func(id int) bool { return !members[id] })
	steps := make([]Step, 0, min(len(route.Steps), MaxSteps))
	for _, step := range route.Steps {
		if checked, ok := checkedStep(step); ok && len(steps) < MaxSteps {
			steps = append(steps, checked)
		}
	}
	return Route{
		Key:        route.Key,
		Name:       within(route.Name, MaxNameLength),
		Characters: characters[:min(len(characters), MaxCharacters)],
		Requires:   route.Requires,
		Condition:  within(route.Condition, MaxConditionLength),
		Ending:     within(route.Ending, MaxEndingLength),
		Steps:      steps,
	}
}

func checkedStep(step Step) (Step, bool) {
	switch step.Kind {
	case StepChoice:
		text := within(step.Text, MaxStepTextLength)
		return Step{Kind: StepChoice, Text: text, Remark: within(step.Remark, MaxRemarkLength)}, text != ""
	case StepNote:
		text := within(step.Text, MaxStepTextLength)
		return Step{Kind: StepNote, Text: text}, text != ""
	case StepSave, StepLoad:
		slot := strings.TrimSpace(step.Slot)
		return Step{Kind: step.Kind, Slot: slot}, slotNumber(slot)
	case StepGap:
		return Step{Kind: StepGap}, true
	}
	return Step{}, false
}

func notePart(paragraphs []string) []string {
	kept := make([]string, 0, len(paragraphs))
	length := 0
	for _, paragraph := range paragraphs {
		text := strings.TrimSpace(paragraph)
		length += utf8.RuneCountInString(text)
		if text == "" || length > MaxNoteLength {
			continue
		}
		kept = append(kept, text)
	}
	return kept
}

func within(value string, limit int) string {
	trimmed := strings.TrimSpace(value)
	if utf8.RuneCountInString(trimmed) > limit {
		return ""
	}
	return trimmed
}

func slotNumber(slot string) bool {
	if slot == "" || len(slot) > MaxSlotDigits {
		return false
	}
	for _, r := range slot {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
