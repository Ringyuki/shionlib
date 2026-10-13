package adhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"ad"}

var adminTags = []string{"ad", "admin"}

type Handler struct {
	service *ad.Service
	resp    *response.Builder
}

func NewHandler(service *ad.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ad.placement", Method: http.MethodGet, Path: "/ad/placement/{placement}", Summary: "Ads shown in a placement; empty for sponsors", Tags: tags}, h.placement)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.list", Method: http.MethodGet, Path: "/admin/ad", Summary: "List ads", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.get", Method: http.MethodGet, Path: "/admin/ad/{id}", Summary: "Get an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.create", Method: http.MethodPost, Path: "/admin/ad", Summary: "Create an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.update", Method: http.MethodPatch, Path: "/admin/ad/{id}", Summary: "Update an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.delete", Method: http.MethodDelete, Path: "/admin/ad/{id}", Summary: "Delete an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.delete)
}

func (h *Handler) placement(ctx context.Context, in *adPlacementInput) (*response.Output[[]adItemDTO], error) {
	ads, err := h.service.Placement(ctx, actor.From(ctx), in.Placement)
	if err != nil {
		return nil, err
	}
	out := make([]adItemDTO, len(ads))
	for i, item := range ads {
		out[i] = toItemDTO(item)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) list(ctx context.Context, in *listAdsInput) (*response.Output[response.Page[adAdminDTO]], error) {
	ads, total, err := h.service.List(ctx, in.filter(), ad.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(ads, total, in.PageSize, in.Page, toAdminDTO)), nil
}

func (h *Handler) get(ctx context.Context, in *adPathInput) (*response.Output[adAdminDTO], error) {
	item, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(item)), nil
}

func (h *Handler) create(ctx context.Context, in *createAdInput) (*response.Output[adAdminDTO], error) {
	body := in.Body
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	sort := 0
	if body.Sort != nil {
		sort = *body.Sort
	}
	created, err := h.service.Create(ctx, ad.NewAd{
		Name:           body.Name,
		Placement:      body.Placement,
		ImageZH:        body.ImageZH,
		ImageJA:        body.ImageJA,
		ImageEN:        body.ImageEN,
		Aspect:         body.Aspect,
		Link:           body.Link,
		ExcludeLocales: body.ExcludeLocales,
		Enabled:        enabled,
		Sort:           sort,
		StartAt:        body.StartAt,
		EndAt:          body.EndAt,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(created)), nil
}

func (h *Handler) update(ctx context.Context, in *updateAdInput) (*response.Output[adAdminDTO], error) {
	updated, err := h.service.Update(ctx, in.ID, in.changes())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(updated)), nil
}

func (h *Handler) delete(ctx context.Context, in *adPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
