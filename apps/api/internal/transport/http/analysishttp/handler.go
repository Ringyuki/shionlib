package analysishttp

import (
	"context"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"analysis"}

type analysisOverviewDTO struct {
	Games       int   `json:"games"`
	Files       int   `json:"files"`
	Resources   int   `json:"resources"`
	Storage     int64 `json:"storage"`
	BytesGotten int64 `json:"bytes_gotten"`
}

type analysisHourDTO struct {
	Hour          time.Time `json:"hour"`
	TotalBytes    int64     `json:"totalBytes"`
	DownloadCount int64     `json:"downloadCount"`
}

type analysisFileDTO struct {
	FileID        string `json:"fileId"`
	FileName      string `json:"fileName"`
	TotalBytes    int64  `json:"totalBytes"`
	DownloadCount int64  `json:"downloadCount"`
}

type analysisCountryDTO struct {
	Country       string `json:"country"`
	TotalBytes    int64  `json:"totalBytes"`
	DownloadCount int64  `json:"downloadCount"`
}

type analysisGameNameDTO struct {
	TitleJP *string `json:"title_jp"`
	TitleZH *string `json:"title_zh"`
	TitleEN *string `json:"title_en"`
}

type analysisGameDTO struct {
	GameID        int                 `json:"gameId"`
	GameName      analysisGameNameDTO `json:"gameName"`
	TotalBytes    int64               `json:"totalBytes"`
	DownloadCount int64               `json:"downloadCount"`
}

type analysisTrafficDTO struct {
	TotalDownloads     int64                `json:"totalDownloads"`
	TotalBytes         int64                `json:"totalBytes"`
	AverageSize        int64                `json:"averageSize"`
	PrevTotalDownloads int64                `json:"prevTotalDownloads"`
	PrevTotalBytes     int64                `json:"prevTotalBytes"`
	PrevAverageSize    int64                `json:"prevAverageSize"`
	Hourly             []analysisHourDTO    `json:"hourly"`
	TopFiles           []analysisFileDTO    `json:"topFiles"`
	Countries          []analysisCountryDTO `json:"countries"`
	TopGames           []analysisGameDTO    `json:"topGames"`
}

type Handler struct {
	service *analysis.Service
	resp    *response.Builder
}

func NewHandler(service *analysis.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "analysis.overview", Method: http.MethodGet, Path: "/analysis/data/overview", Summary: "Site totals and 24-hour traffic", Tags: tags}, h.overview)
	httpapi.Register(api, httpapi.Route{ID: "analysis.trafficDetail", Method: http.MethodGet, Path: "/analysis/data/traffic-detail", Summary: "Download traffic of the last 24 hours", Tags: tags}, h.trafficDetail)
}

func (h *Handler) overview(ctx context.Context, _ *struct{}) (*response.Output[analysisOverviewDTO], error) {
	overview, err := h.service.Overview(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, analysisOverviewDTO{
		Games:       overview.Games,
		Files:       overview.Files,
		Resources:   overview.Resources,
		Storage:     overview.StorageBytes,
		BytesGotten: overview.BytesServed,
	}), nil
}

func (h *Handler) trafficDetail(ctx context.Context, _ *struct{}) (*response.Output[analysisTrafficDTO], error) {
	detail, err := h.service.TrafficDetail(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toTrafficDTO(detail)), nil
}

func toTrafficDTO(detail analysis.TrafficDetail) analysisTrafficDTO {
	out := analysisTrafficDTO{
		TotalDownloads:     detail.Current.DownloadCount,
		TotalBytes:         detail.Current.TotalBytes,
		AverageSize:        detail.Current.AverageSize(),
		PrevTotalDownloads: detail.Previous.DownloadCount,
		PrevTotalBytes:     detail.Previous.TotalBytes,
		PrevAverageSize:    detail.Previous.AverageSize(),
		Hourly:             make([]analysisHourDTO, len(detail.Hourly)),
		TopFiles:           make([]analysisFileDTO, len(detail.TopFiles)),
		Countries:          make([]analysisCountryDTO, len(detail.Countries)),
		TopGames:           make([]analysisGameDTO, len(detail.TopGames)),
	}
	for i, point := range detail.Hourly {
		out.Hourly[i] = analysisHourDTO{Hour: point.Hour, TotalBytes: point.TotalBytes, DownloadCount: point.DownloadCount}
	}
	for i, file := range detail.TopFiles {
		out.TopFiles[i] = analysisFileDTO{FileID: file.FileID, FileName: file.FileName, TotalBytes: file.TotalBytes, DownloadCount: file.DownloadCount}
	}
	for i, country := range detail.Countries {
		out.Countries[i] = analysisCountryDTO{Country: country.Country, TotalBytes: country.TotalBytes, DownloadCount: country.DownloadCount}
	}
	for i, game := range detail.TopGames {
		entry := analysisGameDTO{GameID: game.GameID, TotalBytes: game.TotalBytes, DownloadCount: game.DownloadCount}
		if game.Titles != nil {
			entry.GameName = analysisGameNameDTO{TitleJP: &game.Titles.JP, TitleZH: &game.Titles.ZH, TitleEN: &game.Titles.EN}
		}
		out.TopGames[i] = entry
	}
	return out
}
