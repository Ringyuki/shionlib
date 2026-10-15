package aiwalkthrough

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

var slotStep = regexp.MustCompile(`^(?i)(save|load)\s*([0-9]+)$`)

var remarkSeparators = []string{" | ", " │ "}

type formattedRecord struct {
	Note   []string      `json:"note"`
	Routes []routeRecord `json:"routes"`
}

type routeRecord struct {
	Name       string   `json:"name"`
	Characters []int    `json:"characters"`
	Requires   []int    `json:"requires"`
	Condition  string   `json:"condition"`
	Ending     string   `json:"ending"`
	Steps      []string `json:"steps"`
}

func (r formattedRecord) formatted() walkthrough.Formatted {
	routes := make([]walkthrough.Route, len(r.Routes))
	for i, route := range r.Routes {
		requires := make([]string, 0, len(route.Requires))
		for _, number := range route.Requires {
			if number >= 1 && number <= len(r.Routes) {
				requires = append(requires, routeKey(number))
			}
		}
		steps := make([]walkthrough.Step, len(route.Steps))
		for j, line := range route.Steps {
			steps[j] = toStep(line)
		}
		routes[i] = walkthrough.Route{
			Key:        routeKey(i + 1),
			Name:       route.Name,
			Characters: route.Characters,
			Requires:   requires,
			Condition:  route.Condition,
			Ending:     route.Ending,
			Steps:      steps,
		}
	}
	return walkthrough.Formatted{Note: r.Note, Routes: routes}
}

func routeKey(number int) string {
	return "r" + strconv.Itoa(number)
}

func toStep(line string) walkthrough.Step {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return walkthrough.Step{Kind: walkthrough.StepGap}
	}
	if note, ok := strings.CutPrefix(trimmed, "#"); ok {
		return walkthrough.Step{Kind: walkthrough.StepNote, Text: strings.TrimSpace(note)}
	}
	if found := slotStep.FindStringSubmatch(trimmed); found != nil {
		kind := walkthrough.StepSave
		if strings.EqualFold(found[1], "load") {
			kind = walkthrough.StepLoad
		}
		return walkthrough.Step{Kind: kind, Slot: found[2]}
	}
	for _, separator := range remarkSeparators {
		if at := strings.LastIndex(trimmed, separator); at > 0 {
			return walkthrough.Step{Kind: walkthrough.StepChoice, Text: trimmed[:at], Remark: trimmed[at+len(separator):]}
		}
	}
	return walkthrough.Step{Kind: walkthrough.StepChoice, Text: trimmed}
}
