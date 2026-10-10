package walkthrough

import (
	"slices"
	"strings"
)

type StepKind string

const (
	StepChoice StepKind = "choice"
	StepSave   StepKind = "save"
	StepLoad   StepKind = "load"
	StepNote   StepKind = "note"
	StepGap    StepKind = "gap"
)

type Step struct {
	Kind   StepKind
	Text   string
	Remark string
	Slot   string
}

type Route struct {
	Key        string
	Name       string
	Characters []int
	Requires   []string
	Condition  string
	Ending     string
	Steps      []Step
}

func (s Step) Valid() bool {
	switch s.Kind {
	case StepChoice, StepNote:
		return strings.TrimSpace(s.Text) != ""
	case StepSave, StepLoad:
		return strings.TrimSpace(s.Slot) != ""
	case StepGap:
		return true
	}
	return false
}

func (s Step) tidy() Step {
	switch s.Kind {
	case StepChoice:
		return Step{Kind: StepChoice, Text: strings.TrimSpace(s.Text), Remark: strings.TrimSpace(s.Remark)}
	case StepNote:
		return Step{Kind: StepNote, Text: strings.TrimSpace(s.Text)}
	case StepSave, StepLoad:
		return Step{Kind: s.Kind, Slot: strings.TrimSpace(s.Slot)}
	}
	return Step{Kind: StepGap}
}

func (r Route) Complete() bool {
	return r.Name != "" && slices.ContainsFunc(r.Steps, func(step Step) bool { return step.Kind != StepGap })
}

func Tidy(routes []Route) []Route {
	keys := make(map[string]bool, len(routes))
	for _, route := range routes {
		keys[route.Key] = true
	}
	tidy := make([]Route, len(routes))
	for i, route := range routes {
		tidy[i] = Route{
			Key:        route.Key,
			Name:       strings.TrimSpace(route.Name),
			Characters: distinct(route.Characters, func(int) bool { return true }),
			Requires:   distinct(route.Requires, func(key string) bool { return keys[key] && key != route.Key }),
			Condition:  strings.TrimSpace(route.Condition),
			Ending:     strings.TrimSpace(route.Ending),
			Steps:      tidySteps(route.Steps),
		}
	}
	return tidy
}

func Publishable(hasNote bool, routes []Route) error {
	if !hasNote && len(routes) == 0 {
		return ErrEmpty
	}
	if slices.ContainsFunc(routes, func(route Route) bool { return !route.Complete() }) {
		return ErrRouteIncomplete
	}
	return nil
}

func Text(note string, routes []Route) string {
	lines := []string{note}
	for _, route := range routes {
		lines = append(lines, route.Name, route.Condition)
		for _, step := range route.Steps {
			lines = append(lines, step.Text, step.Remark)
		}
		lines = append(lines, route.Ending)
	}
	return strings.Join(slices.DeleteFunc(lines, func(line string) bool { return line == "" }), "\n")
}

func tidySteps(steps []Step) []Step {
	tidy := make([]Step, 0, len(steps))
	for _, step := range steps {
		next := step.tidy()
		if next.Kind == StepGap && (len(tidy) == 0 || tidy[len(tidy)-1].Kind == StepGap) {
			continue
		}
		tidy = append(tidy, next)
	}
	if last := len(tidy) - 1; last >= 0 && tidy[last].Kind == StepGap {
		tidy = tidy[:last]
	}
	return tidy
}

func distinct[T comparable](values []T, keep func(T) bool) []T {
	kept := make([]T, 0, len(values))
	for _, value := range values {
		if keep(value) && !slices.Contains(kept, value) {
			kept = append(kept, value)
		}
	}
	return kept
}
