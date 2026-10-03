package uploadhttp

import (
	"errors"
	"io"
	"net/http"
	"reflect"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	chunkPath        = "/uploads/large/{id}/chunks/{index}"
	chunkHashHeader  = "chunk-sha256"
	authStaleHeader  = "shionlib-auth-stale"
	jsonContentType  = "application/json; charset=utf-8"
	octetContentType = "application/octet-stream"
)

func (h *Handler) registerChunk(api *httpapi.API) {
	route := http.MethodPut + " " + chunkPath
	api.Router().Method(http.MethodPut, chunkPath, api.Throttled(h.chunks, route, h.chunk(api)))
	documentChunk(api.OpenAPI())
}

func (h *Handler) chunk(api *httpapi.API) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		fail := func(err error) {
			api.ErrorWriter().Write(w, r, api.Mapper().FromError(ctx, err))
		}
		if err := middleware.RequireAuthenticated(ctx); err != nil {
			fail(err)
			return
		}
		limit := h.service.Settings().TransferLimit
		if r.ContentLength > limit {
			fail(errmap.WithStatus(http.StatusRequestEntityTooLarge, nil))
			return
		}
		id, idErr := strconv.Atoi(chi.URLParam(r, "id"))
		index, indexErr := strconv.Atoi(chi.URLParam(r, "index"))
		if idErr != nil || indexErr != nil || id < 1 {
			invalid := apperror.ErrValidationFailed.New()
			if idErr != nil || id < 1 {
				invalid = invalid.WithField("id", h.resp.Translate(ctx, "validation.common.IS_INT", map[string]any{"property": "id"}))
			}
			if indexErr != nil {
				invalid = invalid.WithField("index", h.resp.Translate(ctx, "validation.common.IS_INT", map[string]any{"property": "index"}))
			}
			fail(invalid)
			return
		}
		body := &trackedBody{reader: http.MaxBytesReader(w, r.Body, limit)}
		chunk := upload.Chunk{SHA256: r.Header.Get(chunkHashHeader), ContentLength: max(r.ContentLength, 0)}
		if err := h.service.WriteChunk(ctx, actor.From(ctx), id, index, chunk, body); err != nil {
			fail(body.classify(err))
			return
		}
		out := response.OK(ctx, h.resp, uploadChunkDTO{OK: true, ChunkIndex: index})
		if out.AuthStale != "" {
			w.Header().Set(authStaleHeader, out.AuthStale)
		}
		w.Header().Set("Content-Type", jsonContentType)
		w.WriteHeader(http.StatusOK)
		_ = response.EncodeJSON(w, out.Body)
	}
}

type trackedBody struct {
	reader io.Reader
	err    error
}

func (b *trackedBody) Read(p []byte) (int, error) {
	n, err := b.reader.Read(p)
	if err != nil && !errors.Is(err, io.EOF) {
		b.err = err
	}
	return n, err
}

func (b *trackedBody) classify(err error) error {
	if b.err == nil {
		return err
	}
	var tooLarge *http.MaxBytesError
	if errors.As(b.err, &tooLarge) {
		return errmap.WithStatus(http.StatusRequestEntityTooLarge, err)
	}
	return errmap.WithStatus(http.StatusBadRequest, err)
}

func documentChunk(oapi *huma.OpenAPI) {
	registry := oapi.Components.Schemas
	envelope := registry.Schema(reflect.TypeFor[response.Envelope[uploadChunkDTO]](), true, "UploadChunkEnvelope")
	failure := registry.Schema(reflect.TypeFor[errmap.ErrorResponse](), true, "")
	integer := &huma.Schema{Type: huma.TypeInteger}
	oapi.AddOperation(&huma.Operation{
		OperationID: "upload.chunk",
		Method:      http.MethodPut,
		Path:        chunkPath,
		Summary:     "Upload one chunk of an upload session",
		Tags:        tags,
		Security:    []map[string][]string{{"accessToken": {}}, {"accessCookie": {}}},
		Parameters: []*huma.Param{
			{Name: "id", In: "path", Required: true, Schema: integer},
			{Name: "index", In: "path", Required: true, Schema: integer},
			{Name: chunkHashHeader, In: "header", Required: true, Description: "Lowercase hex SHA-256 of the chunk bytes", Schema: &huma.Schema{Type: huma.TypeString}},
		},
		RequestBody: &huma.RequestBody{
			Required: true,
			Content:  map[string]*huma.MediaType{octetContentType: {Schema: &huma.Schema{Type: huma.TypeString, Format: "binary"}}},
		},
		Responses: map[string]*huma.Response{
			"200":     {Description: "Chunk stored", Content: map[string]*huma.MediaType{"application/json": {Schema: envelope}}},
			"default": {Description: "Error", Content: map[string]*huma.MediaType{"application/json": {Schema: failure}}},
		},
	})
}
