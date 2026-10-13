package activityhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
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
		Meta:  activityPageMetaDTO{PageMeta: response.NewPageMeta(total, len(entries), in.PageSize, in.Page), ContentLimit: int(viewer.ContentLimit)},
	}
	for i, entry := range entries {
		page.Items[i] = toActivityDTO(entry, now)
	}
	return response.OK(ctx, h.resp, page), nil
}
