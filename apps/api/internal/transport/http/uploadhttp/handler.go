package uploadhttp

import (
	"context"
	"net/http"
	"reflect"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
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
		limit := h.service.Options().TransferLimit
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
		body := &trackedBodyInput{reader: http.MaxBytesReader(w, r.Body, limit)}
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
		_ = jsoncodec.Encode(w, out.Body)
	}
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

var tags = []string{"upload"}

type Handler struct {
	service *upload.Service
	quota   *upload.QuotaService
	resp    *response.Builder
	chunks  ratelimit.Policy
}

func NewHandler(service *upload.Service, quota *upload.QuotaService, resp *response.Builder, chunks ratelimit.Policy) *Handler {
	return &Handler{service: service, quota: quota, resp: resp, chunks: chunks}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "upload.ongoing", Method: http.MethodGet, Path: "/uploads/large/ongoing", Summary: "List the caller's unfinished large uploads", Tags: tags, Access: httpapi.AccessUser}, h.ongoing)
	httpapi.Register(api, httpapi.Route{ID: "upload.init", Method: http.MethodPost, Path: "/uploads/large/init", Summary: "Start a chunked upload session", Tags: tags, Access: httpapi.AccessUser}, h.init)
	httpapi.Register(api, httpapi.Route{ID: "upload.status", Method: http.MethodGet, Path: "/uploads/large/{id}/status", Summary: "Read an upload session", Tags: tags, Access: httpapi.AccessUser}, h.status)
	httpapi.Register(api, httpapi.Route{ID: "upload.complete", Method: http.MethodPatch, Path: "/uploads/large/{id}/complete", Summary: "Verify and complete an upload session", Tags: tags, Access: httpapi.AccessUser}, h.complete)
	httpapi.Register(api, httpapi.Route{ID: "upload.abort", Method: http.MethodDelete, Path: "/uploads/large/{id}", Summary: "Abort an upload session", Tags: tags, Access: httpapi.AccessUser}, h.abort)
	httpapi.Register(api, httpapi.Route{ID: "upload.quota", Method: http.MethodGet, Path: "/uploads/quota", Summary: "Read the caller's upload quota", Tags: tags, Access: httpapi.AccessUser}, h.getQuota)
	h.registerChunk(api)
}

func (h *Handler) ongoing(ctx context.Context, _ *struct{}) (*response.Output[[]ongoingUploadDTO], error) {
	sessions, err := h.service.Ongoing(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	out := make([]ongoingUploadDTO, len(sessions))
	for i, session := range sessions {
		out[i] = toOngoingUpload(session)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) init(ctx context.Context, in *initUploadInput) (*response.Output[initUploadDTO], error) {
	session, err := h.service.Init(ctx, actor.From(ctx), upload.InitInput{
		FileName:  in.Body.FileName,
		TotalSize: in.Body.TotalSize,
		ChunkSize: in.Body.ChunkSize,
		FileHash:  in.Body.FileSHA256,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, initUploadDTO{
		UploadSessionID: session.ID,
		ChunkSize:       session.ChunkSize,
		TotalChunks:     session.TotalChunks,
		ExpiresAt:       session.ExpiresAt,
	}), nil
}

func (h *Handler) status(ctx context.Context, in *uploadSessionPathInput) (*response.Output[uploadStatusDTO], error) {
	session, err := h.service.Status(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toUploadStatus(session)), nil
}

func (h *Handler) complete(ctx context.Context, in *uploadSessionPathInput) (*response.Output[uploadCompleteDTO], error) {
	if err := h.service.Complete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, uploadCompleteDTO{OK: true}), nil
}

func (h *Handler) abort(ctx context.Context, in *uploadSessionPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Abort(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) getQuota(ctx context.Context, _ *struct{}) (*response.Output[uploadQuotaDTO], error) {
	quota, err := h.quota.Get(ctx, actor.From(ctx).UserID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, uploadQuotaDTO{Size: quota.Size, Used: quota.Used}), nil
}
