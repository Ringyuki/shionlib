package scanhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type StalledHandler struct {
	service *scan.StalledService
	resp    *response.Builder
}

func NewStalledHandler(service *scan.StalledService, resp *response.Builder) *StalledHandler {
	return &StalledHandler{service: service, resp: resp}
}

func (h *StalledHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminStalledCheck.list", Method: http.MethodGet, Path: "/admin/content/stalled-checks", Summary: "List the files whose check was paused after repeated failures", Tags: tags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminStalledCheck.recheck", Method: http.MethodPost, Path: "/admin/content/stalled-checks/{file_id}/recheck", Summary: "Check a paused file again, with the volumes of its set", Tags: tags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.recheck)
	httpapi.Register(api, httpapi.Route{ID: "adminStalledCheck.remove", Method: http.MethodDelete, Path: "/admin/content/stalled-checks/{file_id}", Summary: "Give up the check of a paused file and remove it, with the volumes of its set", Tags: tags, Access: httpapi.AccessAdmin}, h.remove)
}

func (h *StalledHandler) list(ctx context.Context, _ *struct{}) (*response.Output[[]stalledCheckDTO], error) {
	entries, err := h.service.List(ctx)
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	out := make([]stalledCheckDTO, len(entries))
	for i, entry := range entries {
		out[i] = toStalledCheck(entry, now)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *StalledHandler) recheck(ctx context.Context, in *stalledCheckPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Recheck(ctx, in.FileID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *StalledHandler) remove(ctx context.Context, in *stalledCheckPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Remove(ctx, in.FileID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
