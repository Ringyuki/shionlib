package uploadhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

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

func (h *Handler) status(ctx context.Context, in *uploadSessionPath) (*response.Output[uploadStatusDTO], error) {
	session, err := h.service.Status(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toUploadStatus(session)), nil
}

func (h *Handler) complete(ctx context.Context, in *uploadSessionPath) (*response.Output[uploadCompleteDTO], error) {
	if err := h.service.Complete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, uploadCompleteDTO{OK: true}), nil
}

func (h *Handler) abort(ctx context.Context, in *uploadSessionPath) (*response.EmptyOutput, error) {
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
