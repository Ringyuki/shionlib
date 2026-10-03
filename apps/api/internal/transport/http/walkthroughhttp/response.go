package walkthroughhttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughDTO struct {
	ID      int                     `json:"id"`
	Title   string                  `json:"title"`
	HTML    string                  `json:"html"`
	Lang    *string                 `json:"lang"`
	Created time.Time               `json:"created"`
	Updated time.Time               `json:"updated"`
	Edited  bool                    `json:"edited"`
	Status  string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Creator userhttp.UserSummaryDTO `json:"creator"`
	Content json.RawMessage         `json:"content,omitempty"`
}

type walkthroughItemDTO struct {
	ID      int                     `json:"id"`
	Title   string                  `json:"title"`
	Lang    *string                 `json:"lang"`
	Created time.Time               `json:"created"`
	Updated time.Time               `json:"updated"`
	Edited  bool                    `json:"edited"`
	Status  string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Creator userhttp.UserSummaryDTO `json:"creator"`
}

type walkthroughPageMetaDTO struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type walkthroughPageDTO struct {
	Items []walkthroughItemDTO   `json:"items"`
	Meta  walkthroughPageMetaDTO `json:"meta"`
}

type userWalkthroughDTO struct {
	ID      int                     `json:"id"`
	Title   string                  `json:"title"`
	Lang    *string                 `json:"lang"`
	Created time.Time               `json:"created"`
	Updated time.Time               `json:"updated"`
	Edited  bool                    `json:"edited"`
	Status  string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Game    gamehttp.GameCardDTO    `json:"game"`
	Creator userhttp.UserSummaryDTO `json:"creator"`
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
