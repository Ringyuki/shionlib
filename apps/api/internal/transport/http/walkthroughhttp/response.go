package walkthroughhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughStepDTO struct {
	Kind   string `json:"kind" enum:"choice,save,load,note,gap" doc:"A choice to pick, a save to make, a save to load, a remark, or a pause between groups of steps"`
	Text   string `json:"text" doc:"What a choice or a note says"`
	Remark string `json:"remark" doc:"What a choice leads to"`
	Slot   string `json:"slot" doc:"Number of the save that a save or load step names"`
}

type walkthroughRouteDTO struct {
	Key        string               `json:"key"`
	Name       string               `json:"name"`
	Characters []int                `json:"characters" doc:"Ids of the game's characters the route is about; one the game no longer lists is to be skipped"`
	Requires   []string             `json:"requires" doc:"Keys of the routes to finish before this one"`
	Condition  string               `json:"condition" doc:"What else opens the route"`
	Ending     string               `json:"ending"`
	Steps      []walkthroughStepDTO `json:"steps"`
}

type walkthroughDTO struct {
	ID            int                     `json:"id"`
	GameID        int                     `json:"game_id"`
	Note          richtexthttp.Content    `json:"note,omitempty" doc:"What belongs to no route; left out when nothing was written"`
	Routes        []walkthroughRouteDTO   `json:"routes" doc:"In the order they are best played"`
	Lang          *string                 `json:"lang"`
	Created       time.Time               `json:"created"`
	Updated       time.Time               `json:"updated"`
	Status        string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	ReviewPending bool                    `json:"review_pending" doc:"True while a walkthrough sent for publication waits for review; it is HIDDEN until then"`
	Creator       userhttp.UserSummaryDTO `json:"creator"`
}

type walkthroughSummaryDTO struct {
	ID            int                     `json:"id"`
	RouteCount    int                     `json:"route_count"`
	Lang          *string                 `json:"lang"`
	Updated       time.Time               `json:"updated"`
	Status        string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	ReviewPending bool                    `json:"review_pending"`
	Creator       userhttp.UserSummaryDTO `json:"creator"`
}

type userWalkthroughDTO struct {
	ID            int                  `json:"id"`
	RouteCount    int                  `json:"route_count"`
	Lang          *string              `json:"lang"`
	Updated       time.Time            `json:"updated"`
	Status        string               `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	ReviewPending bool                 `json:"review_pending"`
	Game          gamehttp.GameCardDTO `json:"game"`
}

type userWalkthroughPageMetaDTO struct {
	response.PageMeta
	IsCurrentUser bool `json:"is_current_user"`
	ContentLimit  int  `json:"content_limit"`
}

type userWalkthroughPageDTO struct {
	Items []userWalkthroughDTO       `json:"items"`
	Meta  userWalkthroughPageMetaDTO `json:"meta"`
}

func toRoutes(routes []walkthrough.Route) []walkthroughRouteDTO {
	out := make([]walkthroughRouteDTO, len(routes))
	for i, route := range routes {
		steps := make([]walkthroughStepDTO, len(route.Steps))
		for j, step := range route.Steps {
			steps[j] = walkthroughStepDTO{Kind: string(step.Kind), Text: step.Text, Remark: step.Remark, Slot: step.Slot}
		}
		out[i] = walkthroughRouteDTO{
			Key:        route.Key,
			Name:       route.Name,
			Characters: append([]int{}, route.Characters...),
			Requires:   append([]string{}, route.Requires...),
			Condition:  route.Condition,
			Ending:     route.Ending,
			Steps:      steps,
		}
	}
	return out
}

func toWalkthrough(view walkthrough.View, now time.Time) walkthroughDTO {
	return walkthroughDTO{
		ID:            view.ID,
		GameID:        view.GameID,
		Note:          richtexthttp.Content(view.Note),
		Routes:        toRoutes(view.Routes),
		Lang:          view.Lang,
		Created:       view.Created,
		Updated:       view.Updated,
		Status:        string(view.Status),
		ReviewPending: view.ReviewPending,
		Creator:       userhttp.ToUserSummary(view.Creator, now),
	}
}

func toSummary(summary walkthrough.Summary, now time.Time) walkthroughSummaryDTO {
	return walkthroughSummaryDTO{
		ID:            summary.ID,
		RouteCount:    summary.RouteCount,
		Lang:          summary.Lang,
		Updated:       summary.Updated,
		Status:        string(summary.Status),
		ReviewPending: summary.ReviewPending,
		Creator:       userhttp.ToUserSummary(summary.Creator, now),
	}
}

func toUserItem(summary walkthrough.Summary) userWalkthroughDTO {
	out := userWalkthroughDTO{
		ID:            summary.ID,
		RouteCount:    summary.RouteCount,
		Lang:          summary.Lang,
		Updated:       summary.Updated,
		Status:        string(summary.Status),
		ReviewPending: summary.ReviewPending,
	}
	if summary.Game != nil {
		out.Game = gamehttp.ToGameCard(*summary.Game)
	}
	return out
}
