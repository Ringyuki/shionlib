package downloadhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type NameHandler struct {
	names *download.NameService
	resp  *response.Builder
}

func NewNameHandler(names *download.NameService, resp *response.Builder) *NameHandler {
	return &NameHandler{names: names, resp: resp}
}

func (h *NameHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "download.previewName", Method: http.MethodPost, Path: "/game/{id}/download-source/name", Summary: "Show the canonical name a file of the game would take", Tags: tags, Access: httpapi.AccessUser}, h.preview)
	httpapi.Register(api, httpapi.Route{ID: "download.readName", Method: http.MethodPost, Path: "/game/download-source/name/read", Summary: "Read what the name of a file says about a resource", Tags: tags, Access: httpapi.AccessUser}, h.read)
}

func (h *NameHandler) preview(ctx context.Context, in *previewNameInput) (*response.Output[fileNameDTO], error) {
	name, err := h.names.Preview(ctx, in.preview())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, fileNameDTO(name)), nil
}

func (h *NameHandler) read(ctx context.Context, in *readNameInput) (*response.Output[fileNameReadingDTO], error) {
	return response.OK(ctx, h.resp, toFileNameReadingDTO(download.ReadFileName(in.Body.FileName))), nil
}
