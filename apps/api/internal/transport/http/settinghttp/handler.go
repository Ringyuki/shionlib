package settinghttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var (
	adminTags  = []string{"admin-settings"}
	publicTags = []string{"settings"}
)

type Handler struct {
	service *setting.Service
	resp    *response.Builder
}

func NewHandler(service *setting.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "setting.list", Method: http.MethodGet, Path: "/admin/settings", Summary: "List every tunable setting with its value and bounds", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "setting.update", Method: http.MethodPatch, Path: "/admin/settings/{name}", Summary: "Change a setting", Tags: adminTags, Access: httpapi.AccessSuperAdmin}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "setting.reset", Method: http.MethodDelete, Path: "/admin/settings/{name}", Summary: "Restore a setting to its default", Tags: adminTags, Access: httpapi.AccessSuperAdmin}, h.reset)
	httpapi.Register(api, httpapi.Route{ID: "setting.history", Method: http.MethodGet, Path: "/admin/settings/{name}/history", Summary: "List the changes of a setting", Tags: adminTags, Access: httpapi.AccessAdmin}, h.history)
	httpapi.Register(api, httpapi.Route{ID: "setting.public", Method: http.MethodGet, Path: "/settings/public", Summary: "Read the settings the site shows to visitors", Tags: publicTags}, h.public)
}

func (h *Handler) list(ctx context.Context, _ *struct{}) (*response.Output[[]settingDTO], error) {
	entries, err := h.service.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]settingDTO, len(entries))
	for i, entry := range entries {
		out[i] = toSettingDTO(entry)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) update(ctx context.Context, in *settingUpdateInput) (*response.Output[settingDTO], error) {
	entry, err := h.service.Update(ctx, actor.From(ctx), in.Name, in.Body.Value)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toSettingDTO(entry)), nil
}

func (h *Handler) reset(ctx context.Context, in *settingResetInput) (*response.Output[settingDTO], error) {
	entry, err := h.service.Reset(ctx, actor.From(ctx), in.Name)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toSettingDTO(entry)), nil
}

func (h *Handler) history(ctx context.Context, in *settingHistoryInput) (*response.Output[response.Page[settingChangeDTO]], error) {
	changes, total, err := h.service.History(ctx, in.Name, paging.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(changes, total, in.PageSize, in.Page, toSettingChangeDTO)), nil
}

func (h *Handler) public(ctx context.Context, _ *struct{}) (*response.Output[publicSettingsDTO], error) {
	return response.OK(ctx, h.resp, toPublicSettingsDTO(h.service)), nil
}
