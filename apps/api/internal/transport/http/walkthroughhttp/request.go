package walkthroughhttp

import (
	"fmt"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughPathInput struct {
	ID int `path:"id"`
}

type walkthroughStepInput struct {
	Kind   string `json:"kind" enum:"choice,save,load,note,gap" doc:"A choice to pick, a save to make, a save to load, a remark, or a pause between groups of steps"`
	Text   string `json:"text,omitempty" maxLength:"300" doc:"What a choice or a note says; required for them"`
	Remark string `json:"remark,omitempty" maxLength:"100" doc:"What a choice leads to"`
	Slot   string `json:"slot,omitempty" pattern:"^[0-9]{1,3}$" doc:"Number of the save that a save or load step names; required for them"`
}

type walkthroughRouteInput struct {
	Key        string                 `json:"key" pattern:"^[a-z0-9]{1,16}$" doc:"Name the client gives the route so that other routes can refer to it; no two routes share one"`
	Name       string                 `json:"name" maxLength:"80"`
	Characters []int                  `json:"characters,omitempty" maxItems:"12" doc:"Ids of the game's characters the route is about"`
	Requires   []string               `json:"requires,omitempty" maxItems:"60" doc:"Keys of the routes to finish before this one; a key of no other route is dropped"`
	Condition  string                 `json:"condition,omitempty" maxLength:"300" doc:"What else opens the route"`
	Ending     string                 `json:"ending,omitempty" maxLength:"100"`
	Steps      []walkthroughStepInput `json:"steps" maxItems:"500"`
}

type writeWalkthroughInput struct {
	ID   int `path:"id"`
	Body struct {
		Note   richtexthttp.Content    `json:"note,omitempty" doc:"What belongs to no route: paragraphs with bold, links and spoilers"`
		Routes []walkthroughRouteInput `json:"routes" maxItems:"60" doc:"In the order they are best played"`
		Status string                  `json:"status" enum:"DRAFT,PUBLISHED" doc:"PUBLISHED asks for publication, which needs a note or a route, and a name and a step in every route"`
	}
	note *richtext.Document
}

func (in *writeWalkthroughInput) Resolve(huma.Context) []error {
	var errs []error
	in.note, errs = richtexthttp.ParseOptional(in.Body.Note, "note", richtext.Comment, walkthrough.MaxNoteLength)
	keys := map[string]bool{}
	for i, route := range in.Body.Routes {
		if keys[route.Key] {
			errs = append(errs, &huma.ErrorDetail{Location: fmt.Sprintf("body.routes[%d].key", i), Message: "expected a key no other route has"})
		}
		keys[route.Key] = true
		for j, step := range route.Steps {
			if !toStep(step).Valid() {
				errs = append(errs, &huma.ErrorDetail{
					Location: fmt.Sprintf("body.routes[%d].steps[%d]", i, j),
					Message:  "expected required property " + stated(step.Kind) + " to be present",
				})
			}
		}
	}
	return errs
}

func (in *writeWalkthroughInput) written() walkthrough.WriteInput {
	routes := make([]walkthrough.Route, len(in.Body.Routes))
	for i, route := range in.Body.Routes {
		steps := make([]walkthrough.Step, len(route.Steps))
		for j, step := range route.Steps {
			steps[j] = toStep(step)
		}
		routes[i] = walkthrough.Route{
			Key:        route.Key,
			Name:       route.Name,
			Characters: route.Characters,
			Requires:   route.Requires,
			Condition:  route.Condition,
			Ending:     route.Ending,
			Steps:      steps,
		}
	}
	return walkthrough.WriteInput{GameID: in.ID, Note: in.note, Routes: routes, Publish: in.Body.Status == string(walkthrough.StatusPublished)}
}

func toStep(step walkthroughStepInput) walkthrough.Step {
	return walkthrough.Step{Kind: walkthrough.StepKind(step.Kind), Text: step.Text, Remark: step.Remark, Slot: step.Slot}
}

func stated(kind string) string {
	if kind == string(walkthrough.StepSave) || kind == string(walkthrough.StepLoad) {
		return "slot"
	}
	return "text"
}

type userWalkthroughsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
}
