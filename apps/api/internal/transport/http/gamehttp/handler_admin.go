package gamehttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *game.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *game.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminGame.list", Method: http.MethodGet, Path: "/admin/content/games", Summary: "List games for administration", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminGame.setStatus", Method: http.MethodPatch, Path: "/admin/content/games/{id}/status", Summary: "Show or hide a game", Tags: adminTags, Access: httpapi.AccessAdmin}, h.setStatus)
	httpapi.Register(api, httpapi.Route{ID: "adminGame.scalar", Method: http.MethodGet, Path: "/admin/content/games/{id}/edit/scalar", Summary: "Read the editable fields of a game", Tags: adminTags, Access: httpapi.AccessAdmin}, h.scalar)
	httpapi.Register(api, httpapi.Route{ID: "adminGame.editScalar", Method: http.MethodPatch, Path: "/admin/content/games/{id}/edit/scalar", Summary: "Edit the scalar fields of a game", Tags: adminTags, Access: httpapi.AccessAdmin}, h.editScalar)
	httpapi.Register(api, httpapi.Route{ID: "adminGame.delete", Method: http.MethodDelete, Path: "/admin/content/games/{id}", Summary: "Delete a game and keep it out of catalog imports", Tags: adminTags, Access: httpapi.AccessAdmin}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "adminGame.markRecentUpdate", Method: http.MethodPut, Path: "/admin/content/games/{id}/recent-update", Summary: "Mark a game as recently updated", Tags: adminTags, Access: httpapi.AccessAdmin}, h.markRecentUpdate)
	httpapi.Register(api, httpapi.Route{ID: "adminGame.unmarkRecentUpdate", Method: http.MethodDelete, Path: "/admin/content/games/{id}/recent-update", Summary: "Remove a game from the recent updates", Tags: adminTags, Access: httpapi.AccessAdmin}, h.unmarkRecentUpdate)
}

func (h *AdminHandler) list(ctx context.Context, in *adminGameListInput) (*response.Output[response.Page[adminGameItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, in.filter(), game.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toAdminGameItem)), nil
}

func (h *AdminHandler) setStatus(ctx context.Context, in *adminGameStatusInput) (*response.EmptyOutput, error) {
	if err := h.service.SetStatus(ctx, in.ID, game.Status(in.Body.Status)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) scalar(ctx context.Context, in *adminGamePathInput) (*response.Output[adminGameScalarDTO], error) {
	scalar, err := h.service.Scalar(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminGameScalar(scalar)), nil
}

func (h *AdminHandler) editScalar(ctx context.Context, in *adminGameScalarInput) (*response.EmptyOutput, error) {
	if err := h.service.EditScalar(ctx, in.ID, in.changes()); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) delete(ctx context.Context, in *adminGamePathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) markRecentUpdate(ctx context.Context, in *adminGamePathInput) (*response.EmptyOutput, error) {
	if err := h.service.MarkRecentlyUpdated(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) unmarkRecentUpdate(ctx context.Context, in *adminGamePathInput) (*response.EmptyOutput, error) {
	if err := h.service.UnmarkRecentlyUpdated(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
