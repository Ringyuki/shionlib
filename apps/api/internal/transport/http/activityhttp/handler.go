package activityhttp

import (
	"context"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type Handler struct {
	service *activity.Service
	resp    *response.Builder
}

func NewHandler(service *activity.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "activity.list", Method: http.MethodGet, Path: "/activity/list", Summary: "Site activity feed", Tags: []string{"activity"}}, h.list)
}

type listActivitiesInput struct {
	httpapi.PageQuery
	Category string `query:"category" enum:"comments,gameCreates,walkthroughCreates,edits,files"`
}

type activityWalkthroughDTO struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
}

type activityCommentDTO struct {
	ID   int     `json:"id"`
	HTML *string `json:"html"`
}

type activityDeveloperDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type activityCharacterDTO struct {
	ID     int     `json:"id"`
	NameJP string  `json:"name_jp"`
	NameZH *string `json:"name_zh"`
	NameEN *string `json:"name_en"`
}

type activityFileDTO struct {
	ID              int    `json:"id"`
	FileName        string `json:"file_name"`
	FileSize        int64  `json:"file_size"`
	FileStatus      *int   `json:"file_status"`
	FileCheckStatus *int   `json:"file_check_status"`
}

type activityDTO struct {
	ID          int                     `json:"id"`
	Type        string                  `json:"type"`
	User        userhttp.UserSummary    `json:"user"`
	Game        *gamehttp.GameCard      `json:"game"`
	Walkthrough *activityWalkthroughDTO `json:"walkthrough"`
	Comment     *activityCommentDTO     `json:"comment"`
	Developer   *activityDeveloperDTO   `json:"developer"`
	Character   *activityCharacterDTO   `json:"character"`
	File        *activityFileDTO        `json:"file,omitempty"`
	Created     time.Time               `json:"created"`
	Updated     time.Time               `json:"updated"`
}

type activityPageMeta struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type activityPageDTO struct {
	Items []activityDTO    `json:"items"`
	Meta  activityPageMeta `json:"meta"`
}

func (h *Handler) list(ctx context.Context, in *listActivitiesInput) (*response.Output[activityPageDTO], error) {
	viewer := actor.From(ctx)
	var category *activity.Category
	if in.Category != "" {
		value := activity.Category(in.Category)
		category = &value
	}
	entries, total, err := h.service.Feed(ctx, viewer, category, activity.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := activityPageDTO{
		Items: make([]activityDTO, len(entries)),
		Meta:  activityPageMeta{PageMeta: response.NewPageMeta(total, len(entries), in.PageSize, in.Page), ContentLimit: int(viewer.ContentLimit)},
	}
	for i, entry := range entries {
		page.Items[i] = toActivityDTO(entry, now)
	}
	return response.OK(ctx, h.resp, page), nil
}

func toActivityDTO(entry activity.Entry, now time.Time) activityDTO {
	out := activityDTO{
		ID:      entry.ID,
		Type:    string(entry.Type),
		User:    userhttp.ToUserSummary(entry.User, now),
		Created: entry.Created,
		Updated: entry.Updated,
	}
	if entry.Game != nil {
		card := gamehttp.ToGameCard(*entry.Game)
		out.Game = &card
	}
	if ref := entry.Walkthrough; ref != nil {
		out.Walkthrough = &activityWalkthroughDTO{ID: ref.ID, Title: ref.Title}
	}
	if ref := entry.Comment; ref != nil {
		out.Comment = &activityCommentDTO{ID: ref.ID, HTML: ref.HTML}
	}
	if ref := entry.Developer; ref != nil {
		out.Developer = &activityDeveloperDTO{ID: ref.ID, Name: ref.Name}
	}
	if ref := entry.Character; ref != nil {
		out.Character = &activityCharacterDTO{ID: ref.ID, NameJP: ref.NameJP, NameZH: ref.NameZH, NameEN: ref.NameEN}
	}
	if ref := entry.File; ref != nil {
		out.File = &activityFileDTO{ID: ref.ID, FileName: ref.FileName, FileSize: ref.FileSize, FileStatus: ref.FileStatus, FileCheckStatus: ref.FileCheckStatus}
	}
	return out
}
