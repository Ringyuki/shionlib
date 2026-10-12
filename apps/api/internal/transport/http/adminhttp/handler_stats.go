package adminhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type StatsHandler struct {
	service *admin.StatsService
	resp    *response.Builder
}

func NewStatsHandler(service *admin.StatsService, resp *response.Builder) *StatsHandler {
	return &StatsHandler{service: service, resp: resp}
}

func (h *StatsHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminStats.overview", Method: http.MethodGet, Path: "/admin/stats/overview", Summary: "Site totals for the dashboard", Tags: tags, Access: httpapi.AccessAdmin}, h.overview)
	httpapi.Register(api, httpapi.Route{ID: "adminStats.trends", Method: http.MethodGet, Path: "/admin/stats/trends", Summary: "Daily new games and users, downloads and views", Tags: tags, Access: httpapi.AccessAdmin}, h.trends)
	httpapi.Register(api, httpapi.Route{ID: "adminStats.storage", Method: http.MethodGet, Path: "/admin/stats/storage", Summary: "The staging volume and files by stage", Tags: tags, Access: httpapi.AccessAdmin}, h.storage)
	httpapi.Register(api, httpapi.Route{ID: "adminStats.pending", Method: http.MethodGet, Path: "/admin/pending", Summary: "How much waits for an admin, by kind", Tags: tags, Access: httpapi.AccessAdmin}, h.pending)
}

func (h *StatsHandler) overview(ctx context.Context, _ *struct{}) (*response.Output[adminStatsOverviewDTO], error) {
	overview, err := h.service.Overview(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, adminStatsOverviewDTO(overview)), nil
}

func (h *StatsHandler) trends(ctx context.Context, in *adminStatsTrendsInput) (*response.Output[[]adminStatsTrendDTO], error) {
	points, err := h.service.Trends(ctx, in.Days)
	if err != nil {
		return nil, err
	}
	out := make([]adminStatsTrendDTO, len(points))
	for i, point := range points {
		out[i] = adminStatsTrendDTO(point)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *StatsHandler) storage(ctx context.Context, _ *struct{}) (*response.Output[adminStorageDTO], error) {
	storage, err := h.service.Storage(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toStorageDTO(storage)), nil
}

func (h *StatsHandler) pending(ctx context.Context, _ *struct{}) (*response.Output[adminPendingDTO], error) {
	pending, err := h.service.Pending(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, adminPendingDTO(pending)), nil
}

var tags = []string{"admin"}
