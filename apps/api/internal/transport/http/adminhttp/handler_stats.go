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
	httpapi.Register(api, httpapi.Route{ID: "adminStats.trends", Method: http.MethodGet, Path: "/admin/stats/trends", Summary: "Daily new games and users", Tags: tags, Access: httpapi.AccessAdmin}, h.trends)
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

var tags = []string{"admin"}
