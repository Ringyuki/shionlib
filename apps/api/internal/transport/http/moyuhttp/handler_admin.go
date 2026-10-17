package moyuhttp

import (
	"context"
	"errors"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *moyu.AssignmentService
	resp    *response.Builder
}

func NewAdminHandler(service *moyu.AssignmentService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminPatchPages.read", Method: http.MethodGet, Path: "/admin/content/games/{id}/patch-pages", Summary: "The pages of a game on 鲲 Galgame 补丁, found by its ids or assigned by hand", Tags: adminTags, Access: httpapi.AccessAdmin}, h.read)
	httpapi.Register(api, httpapi.Route{ID: "adminPatchPages.assign", Method: http.MethodPut, Path: "/admin/content/games/{id}/patch-pages", Summary: "Assign the pages of a game on 鲲 Galgame 补丁 by hand, or find them by its ids again", Tags: adminTags, Access: httpapi.AccessAdmin}, h.assign)
	httpapi.Register(api, httpapi.Route{ID: "adminPatchPages.lookup", Method: http.MethodPost, Path: "/admin/content/patch-pages/lookup", Summary: "Read the page of 鲲 Galgame 补丁 an address points to", Tags: adminTags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.lookup)
}

func (h *AdminHandler) read(ctx context.Context, in *adminPatchPagesInput) (*response.Output[adminPatchPagesDTO], error) {
	assignment, err := h.service.Assignment(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminPatchPagesDTO(assignment)), nil
}

func (h *AdminHandler) assign(ctx context.Context, in *adminPatchPagesAssignInput) (*response.EmptyOutput, error) {
	if err := h.service.Assign(ctx, actor.From(ctx), in.ID, in.Body.Manual, in.Body.Pages); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) lookup(ctx context.Context, in *adminPatchPageLookupInput) (*response.Output[PatchPageDTO], error) {
	page, err := h.service.Lookup(ctx, in.Body.Address)
	if errors.Is(err, moyu.ErrAddressUnrecognized) || errors.Is(err, moyu.ErrPageNotFound) {
		if refused, ok := apperror.From(err); ok {
			return nil, refused.WithField("address", h.resp.Translate(ctx, refused.MessageKey(), nil))
		}
	}
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toPatchPageDTO(page)), nil
}
