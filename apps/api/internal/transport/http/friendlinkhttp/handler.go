package friendlinkhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"friend link"}

var adminTags = []string{"friend link", "admin"}

type Handler struct {
	service *friendlink.Service
	resp    *response.Builder
}

func NewHandler(service *friendlink.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "friendLink.list", Method: http.MethodGet, Path: "/friend-links", Summary: "List the friend links shown on the site, in their order", Tags: tags}, h.visible)
	httpapi.Register(api, httpapi.Route{ID: "friendLink.admin.list", Method: http.MethodGet, Path: "/admin/friend-links", Summary: "List every friend link, hidden ones too, in their order", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "friendLink.admin.create", Method: http.MethodPost, Path: "/admin/friend-links", Summary: "Add a friend link after the others", Tags: adminTags, Access: httpapi.AccessAdmin}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "friendLink.admin.update", Method: http.MethodPatch, Path: "/admin/friend-links/{id}", Summary: "Edit a friend link", Tags: adminTags, Access: httpapi.AccessAdmin}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "friendLink.admin.reorder", Method: http.MethodPut, Path: "/admin/friend-links/order", Summary: "Set the order of every friend link", Tags: adminTags, Access: httpapi.AccessAdmin}, h.reorder)
	httpapi.Register(api, httpapi.Route{ID: "friendLink.admin.delete", Method: http.MethodDelete, Path: "/admin/friend-links/{id}", Summary: "Delete a friend link", Tags: adminTags, Access: httpapi.AccessAdmin}, h.delete)
}

func (h *Handler) visible(ctx context.Context, _ *struct{}) (*response.Output[[]friendLinkDTO], error) {
	links, err := h.service.Visible(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]friendLinkDTO, len(links))
	for i, link := range links {
		out[i] = toDTO(link)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) list(ctx context.Context, _ *struct{}) (*response.Output[[]friendLinkAdminDTO], error) {
	links, err := h.service.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]friendLinkAdminDTO, len(links))
	for i, link := range links {
		out[i] = toAdminDTO(link)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) create(ctx context.Context, in *createFriendLinkInput) (*response.Output[friendLinkAdminDTO], error) {
	created, err := h.service.Create(ctx, in.link())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(created)), nil
}

func (h *Handler) update(ctx context.Context, in *updateFriendLinkInput) (*response.Output[friendLinkAdminDTO], error) {
	updated, err := h.service.Update(ctx, in.ID, in.changes())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(updated)), nil
}

func (h *Handler) reorder(ctx context.Context, in *reorderFriendLinksInput) (*response.EmptyOutput, error) {
	if err := h.service.Reorder(ctx, in.Body.IDs); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) delete(ctx context.Context, in *friendLinkPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
