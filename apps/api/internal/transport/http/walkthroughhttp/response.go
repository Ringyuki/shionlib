package walkthroughhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughDTO struct {
	ID            int                     `json:"id"`
	GameID        int                     `json:"game_id"`
	Title         string                  `json:"title"`
	Text          string                  `json:"text"`
	Excerpt       string                  `json:"excerpt" doc:"The first words of the text, without what is marked as a spoiler"`
	Lang          *string                 `json:"lang"`
	Created       time.Time               `json:"created"`
	Updated       time.Time               `json:"updated"`
	Edited        bool                    `json:"edited"`
	Status        string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	ReviewPending bool                    `json:"review_pending" doc:"True while a walkthrough sent for publication waits for review; it is HIDDEN until then"`
	Creator       userhttp.UserSummaryDTO `json:"creator"`
	Content       richtexthttp.Content    `json:"content,omitempty"`
}

type walkthroughItemDTO struct {
	ID            int                     `json:"id"`
	Title         string                  `json:"title"`
	Excerpt       string                  `json:"excerpt" doc:"The first words of the text, without what is marked as a spoiler"`
	Lang          *string                 `json:"lang"`
	Created       time.Time               `json:"created"`
	Updated       time.Time               `json:"updated"`
	Edited        bool                    `json:"edited"`
	Status        string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	ReviewPending bool                    `json:"review_pending"`
	Creator       userhttp.UserSummaryDTO `json:"creator"`
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
	ID            int                     `json:"id"`
	Title         string                  `json:"title"`
	Excerpt       string                  `json:"excerpt" doc:"The first words of the text, without what is marked as a spoiler"`
	Lang          *string                 `json:"lang"`
	Created       time.Time               `json:"created"`
	Updated       time.Time               `json:"updated"`
	Edited        bool                    `json:"edited"`
	Status        string                  `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	ReviewPending bool                    `json:"review_pending"`
	Game          gamehttp.GameCardDTO    `json:"game"`
	Creator       userhttp.UserSummaryDTO `json:"creator"`
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
		ID:            view.ID,
		GameID:        view.GameID,
		Title:         view.Title,
		Text:          view.Text,
		Excerpt:       view.Excerpt,
		Lang:          view.Lang,
		Created:       view.Created,
		Updated:       view.Updated,
		Edited:        view.Edited,
		Status:        string(view.Status),
		ReviewPending: view.ReviewPending,
		Creator:       userhttp.ToUserSummary(view.Creator, now),
		Content:       richtexthttp.Content(view.Content),
	}
}

func toItem(summary walkthrough.Summary, now time.Time) walkthroughItemDTO {
	return walkthroughItemDTO{
		ID:            summary.ID,
		Title:         summary.Title,
		Excerpt:       summary.Excerpt,
		Lang:          summary.Lang,
		Created:       summary.Created,
		Updated:       summary.Updated,
		Edited:        summary.Edited,
		Status:        string(summary.Status),
		ReviewPending: summary.ReviewPending,
		Creator:       userhttp.ToUserSummary(summary.Creator, now),
	}
}

func toUserItem(summary walkthrough.Summary, now time.Time) userWalkthroughDTO {
	out := userWalkthroughDTO{
		ID:            summary.ID,
		Title:         summary.Title,
		Excerpt:       summary.Excerpt,
		Lang:          summary.Lang,
		Created:       summary.Created,
		Updated:       summary.Updated,
		Edited:        summary.Edited,
		Status:        string(summary.Status),
		ReviewPending: summary.ReviewPending,
		Creator:       userhttp.ToUserSummary(summary.Creator, now),
	}
	if summary.Game != nil {
		out.Game = gamehttp.ToGameCard(*summary.Game)
	}
	return out
}
