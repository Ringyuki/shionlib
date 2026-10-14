package apikeyhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"api key"}

type Handler struct {
	service *apikey.Service
	resp    *response.Builder
}

func NewHandler(service *apikey.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "apiKey.mine", Method: http.MethodGet, Path: "/user/api-keys", Summary: "List the caller's API keys", Tags: tags, Access: httpapi.AccessUser}, h.mine)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.create", Method: http.MethodPost, Path: "/user/api-keys", Summary: "Create an API key and show it once", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.delete", Method: http.MethodDelete, Path: "/user/api-keys/{id}", Summary: "Delete one of the caller's API keys", Tags: tags, Access: httpapi.AccessUser}, h.delete)
}

func (h *Handler) mine(ctx context.Context, _ *struct{}) (*response.Output[myKeysDTO], error) {
	mine, err := h.service.Mine(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, myKeysDTO{Keys: toKeyDTOs(mine.Keys), Limit: mine.Limit, Enabled: mine.Enabled}), nil
}

func (h *Handler) create(ctx context.Context, in *createKeyInput) (*response.Output[issuedKeyDTO], error) {
	issued, err := h.service.Create(ctx, actor.From(ctx), in.Body.Name)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, issuedKeyDTO{Key: toKeyDTO(issued.Key), Secret: issued.Secret}), nil
}

func (h *Handler) delete(ctx context.Context, in *keyPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
