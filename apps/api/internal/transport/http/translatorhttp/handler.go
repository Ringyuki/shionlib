package translatorhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"translator"}

type Handler struct {
	service *translator.Service
	resp    *response.Builder
}

func NewHandler(service *translator.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "translator.list", Method: http.MethodGet, Path: "/translator/list", Summary: "List translators that have published works", Tags: tags}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "translator.suggest", Method: http.MethodGet, Path: "/translator/suggest", Summary: "Suggest translators for a name being typed", Tags: tags}, h.suggest)
	httpapi.Register(api, httpapi.Route{ID: "translator.get", Method: http.MethodGet, Path: "/translator/{id}", Summary: "Get a translator", Tags: tags}, h.get)
}

func (h *Handler) list(ctx context.Context, in *listTranslatorsInput) (*response.Output[response.Page[translatorListItemDTO]], error) {
	items, total, err := h.service.List(ctx, in.Q, translator.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(items, total, in.PageSize, in.Page, toTranslatorListItemDTO)), nil
}

func (h *Handler) suggest(ctx context.Context, in *suggestTranslatorsInput) (*response.Output[[]translatorListItemDTO], error) {
	items, err := h.service.Suggest(ctx, in.Q)
	if err != nil {
		return nil, err
	}
	suggestions := make([]translatorListItemDTO, len(items))
	for i, item := range items {
		suggestions[i] = toTranslatorListItemDTO(item)
	}
	return response.OK(ctx, h.resp, suggestions), nil
}

func (h *Handler) get(ctx context.Context, in *translatorPathInput) (*response.Output[translatorDetailDTO], error) {
	detail, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toTranslatorDetailDTO(detail)), nil
}
