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

type adminStatsTrendsInput struct {
	Days int `query:"days" default:"30" minimum:"1" maximum:"90" doc:"Number of days ending today (UTC+8)"`
}

type adminStatsOverviewDTO struct {
	TotalGames      int   `json:"totalGames"`
	TotalUsers      int   `json:"totalUsers"`
	TotalDownloads  int64 `json:"totalDownloads"`
	TotalViews      int64 `json:"totalViews"`
	TotalCharacters int   `json:"totalCharacters"`
	TotalDevelopers int   `json:"totalDevelopers"`
	TotalComments   int   `json:"totalComments"`
	NewGamesToday   int   `json:"newGamesToday"`
	NewUsersToday   int   `json:"newUsersToday"`
}

type adminStatsTrendDTO struct {
	Date      string `json:"date" doc:"YYYY-MM-DD in UTC+8"`
	Games     int    `json:"games"`
	Users     int    `json:"users"`
	Downloads int    `json:"downloads" doc:"Always 0; daily downloads are not tracked"`
	Views     int    `json:"views" doc:"Always 0; daily views are not tracked"`
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
