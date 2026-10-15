package searchhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/mediahttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const ImageThrottle = "image-search"

type ImageHandler struct {
	service *search.ImageService
	resp    *response.Builder
}

func NewImageHandler(service *search.ImageService, resp *response.Builder) *ImageHandler {
	return &ImageHandler{service: service, resp: resp}
}

func (h *ImageHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "search.image", Method: http.MethodPost, Path: "/search/image", Summary: "Find the games and characters a picture shows", Tags: tags, Status: http.StatusOK, Throttle: ImageThrottle, MaxBodyBytes: mediahttp.BodyLimit(search.ImageMaxBytes)}, h.image)
	httpapi.Register(api, httpapi.Route{ID: "search.imageSource", Method: http.MethodGet, Path: "/search/image/source", Summary: "Service that recognizes pictures, to credit it", Tags: tags}, h.source)
}

func (h *ImageHandler) source(ctx context.Context, _ *struct{}) (*response.Output[searchImageSourceDTO], error) {
	source := h.service.Source()
	return response.OK(ctx, h.resp, searchImageSourceDTO{Name: source.Name, URL: source.URL}), nil
}

func (h *ImageHandler) image(ctx context.Context, in *searchImageInput) (*response.Output[searchImageDTO], error) {
	upload, err := mediahttp.ReadUpload(in.RawBody.Data().File, search.ImageMaxBytes)
	if err != nil {
		return nil, err
	}
	var picture []byte
	if upload != nil {
		picture = upload.Data
	}
	results, err := h.service.Search(ctx, actor.From(ctx), picture)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toImageDTO(results)), nil
}
