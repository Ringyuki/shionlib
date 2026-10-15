package walkthroughredis

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type stepRecord struct {
	Kind   string `json:"k"`
	Text   string `json:"t,omitempty"`
	Remark string `json:"r,omitempty"`
	Slot   string `json:"s,omitempty"`
}

type routeRecord struct {
	Key        string       `json:"key"`
	Name       string       `json:"name,omitempty"`
	Characters []int        `json:"characters,omitempty"`
	Requires   []string     `json:"requires,omitempty"`
	Condition  string       `json:"condition,omitempty"`
	Ending     string       `json:"ending,omitempty"`
	Steps      []stepRecord `json:"steps,omitempty"`
}

type taskRecord struct {
	ID      string        `json:"id"`
	OwnerID int           `json:"owner_id"`
	GameID  int           `json:"game_id"`
	Text    string        `json:"text,omitempty"`
	State   string        `json:"state"`
	Started time.Time     `json:"started"`
	Note    []string      `json:"note,omitempty"`
	Routes  []routeRecord `json:"routes,omitempty"`
	Failure string        `json:"failure,omitempty"`
}

func toTaskRecord(task walkthrough.FormatTask) taskRecord {
	routes := make([]routeRecord, len(task.Result.Routes))
	for i, route := range task.Result.Routes {
		steps := make([]stepRecord, len(route.Steps))
		for j, step := range route.Steps {
			steps[j] = stepRecord{Kind: string(step.Kind), Text: step.Text, Remark: step.Remark, Slot: step.Slot}
		}
		routes[i] = routeRecord{
			Key:        route.Key,
			Name:       route.Name,
			Characters: route.Characters,
			Requires:   route.Requires,
			Condition:  route.Condition,
			Ending:     route.Ending,
			Steps:      steps,
		}
	}
	return taskRecord{
		ID:      task.ID,
		OwnerID: task.OwnerID,
		GameID:  task.GameID,
		Text:    task.Text,
		State:   string(task.State),
		Started: task.Started,
		Note:    task.Result.Note,
		Routes:  routes,
		Failure: task.Failure,
	}
}

func (r taskRecord) toTask() walkthrough.FormatTask {
	routes := make([]walkthrough.Route, len(r.Routes))
	for i, route := range r.Routes {
		steps := make([]walkthrough.Step, len(route.Steps))
		for j, step := range route.Steps {
			steps[j] = walkthrough.Step{Kind: walkthrough.StepKind(step.Kind), Text: step.Text, Remark: step.Remark, Slot: step.Slot}
		}
		routes[i] = walkthrough.Route{
			Key:        route.Key,
			Name:       route.Name,
			Characters: nonNil(route.Characters),
			Requires:   nonNil(route.Requires),
			Condition:  route.Condition,
			Ending:     route.Ending,
			Steps:      steps,
		}
	}
	return walkthrough.FormatTask{
		ID:      r.ID,
		OwnerID: r.OwnerID,
		GameID:  r.GameID,
		Text:    r.Text,
		State:   walkthrough.FormatState(r.State),
		Started: r.Started,
		Result:  walkthrough.Formatted{Note: nonNil(r.Note), Routes: routes},
		Failure: r.Failure,
	}
}

func nonNil[T any](values []T) []T {
	if values == nil {
		return []T{}
	}
	return values
}
