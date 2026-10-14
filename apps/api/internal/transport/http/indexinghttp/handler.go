package indexinghttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"site"}

type Handler struct {
	service *indexing.Service
	resp    *response.Builder
}

func NewHandler(service *indexing.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "indexing.key", Method: http.MethodGet, Path: "/indexing/key", Summary: "The IndexNow key the site file serves", Tags: tags}, h.key)
}

func (h *Handler) key(ctx context.Context, _ *struct{}) (*response.Output[indexingKeyDTO], error) {
	return response.OK(ctx, h.resp, indexingKeyDTO{Key: h.service.Key()}), nil
}
