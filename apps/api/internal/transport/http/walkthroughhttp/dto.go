package walkthroughhttp

import (
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/lexicalhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughPath struct {
	ID int `path:"id"`
}

type createWalkthroughInput struct {
	Body struct {
		GameID  int             `json:"game_id"`
		Title   string          `json:"title" minLength:"1" maxLength:"255"`
		Content json.RawMessage `json:"content" doc:"Lexical editor state"`
		Status  string          `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	}
	document lexical.Document
}

func (in *createWalkthroughInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = lexicalhttp.Parse(in.Body.Content, walkthrough.MaxContentLength)
	return errs
}

type updateWalkthroughInput struct {
	ID   int `path:"id"`
	Body struct {
		Title   string          `json:"title" minLength:"1" maxLength:"255"`
		Content json.RawMessage `json:"content" doc:"Lexical editor state"`
		Status  string          `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	}
	document lexical.Document
}

func (in *updateWalkthroughInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = lexicalhttp.Parse(in.Body.Content, walkthrough.MaxContentLength)
	return errs
}

type getWalkthroughInput struct {
	ID          int    `path:"id"`
	WithContent string `query:"withContent" doc:"Only the literal true includes the editor state"`
}

type gameWalkthroughsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
	Status string `query:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
}

type userWalkthroughsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
	Status string `query:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
}

func statusFilter(value string) *walkthrough.Status {
	if value == "" {
		return nil
	}
	status := walkthrough.Status(value)
	return &status
}

type walkthroughDTO struct {
	ID      int                  `json:"id"`
	Title   string               `json:"title"`
	HTML    string               `json:"html"`
	Lang    *string              `json:"lang"`
	Created time.Time            `json:"created"`
	Updated time.Time            `json:"updated"`
	Edited  bool                 `json:"edited"`
	Status  string               `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Creator userhttp.UserSummary `json:"creator"`
	Content json.RawMessage      `json:"content,omitempty"`
}

type walkthroughItemDTO struct {
	ID      int                  `json:"id"`
	Title   string               `json:"title"`
	Lang    *string              `json:"lang"`
	Created time.Time            `json:"created"`
	Updated time.Time            `json:"updated"`
	Edited  bool                 `json:"edited"`
	Status  string               `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Creator userhttp.UserSummary `json:"creator"`
}

type walkthroughPageMeta struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type walkthroughPageDTO struct {
	Items []walkthroughItemDTO `json:"items"`
	Meta  walkthroughPageMeta  `json:"meta"`
}

type userWalkthroughDTO struct {
	ID      int                  `json:"id"`
	Title   string               `json:"title"`
	Lang    *string              `json:"lang"`
	Created time.Time            `json:"created"`
	Updated time.Time            `json:"updated"`
	Edited  bool                 `json:"edited"`
	Status  string               `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Game    gamehttp.GameCard    `json:"game"`
	Creator userhttp.UserSummary `json:"creator"`
}

type userWalkthroughPageMeta struct {
	response.PageMeta
	IsCurrentUser bool `json:"is_current_user"`
	ContentLimit  int  `json:"content_limit"`
}

type userWalkthroughPageDTO struct {
	Items []userWalkthroughDTO    `json:"items"`
	Meta  userWalkthroughPageMeta `json:"meta"`
}

func toWalkthrough(view walkthrough.View, now time.Time) walkthroughDTO {
	return walkthroughDTO{
		ID:      view.ID,
		Title:   view.Title,
		HTML:    view.HTML,
		Lang:    view.Lang,
		Created: view.Created,
		Updated: view.Updated,
		Edited:  view.Edited,
		Status:  string(view.Status),
		Creator: userhttp.ToUserSummary(view.Creator, now),
		Content: view.Content,
	}
}

func toItem(summary walkthrough.Summary, now time.Time) walkthroughItemDTO {
	return walkthroughItemDTO{
		ID:      summary.ID,
		Title:   summary.Title,
		Lang:    summary.Lang,
		Created: summary.Created,
		Updated: summary.Updated,
		Edited:  summary.Edited,
		Status:  string(summary.Status),
		Creator: userhttp.ToUserSummary(summary.Creator, now),
	}
}

func toUserItem(summary walkthrough.Summary, now time.Time) userWalkthroughDTO {
	out := userWalkthroughDTO{
		ID:      summary.ID,
		Title:   summary.Title,
		Lang:    summary.Lang,
		Created: summary.Created,
		Updated: summary.Updated,
		Edited:  summary.Edited,
		Status:  string(summary.Status),
		Creator: userhttp.ToUserSummary(summary.Creator, now),
	}
	if summary.Game != nil {
		out.Game = gamehttp.ToGameCard(*summary.Game)
	}
	return out
}
