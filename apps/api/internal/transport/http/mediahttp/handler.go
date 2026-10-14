package mediahttp

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const multipartOverhead = 64 << 10

var tags = []string{"upload"}

func BodyLimit(fileLimit int) int64 {
	return int64(fileLimit) + multipartOverhead
}

func ReadUpload(file huma.FormFile, fileLimit int) (*media.Upload, error) {
	if !file.IsSet || file.File == nil {
		return nil, nil
	}
	defer func() {
		_ = file.Close()
	}()
	if file.Size > int64(fileLimit) {
		return nil, errmap.WithStatus(http.StatusRequestEntityTooLarge, fmt.Errorf("file of %d bytes exceeds %d", file.Size, fileLimit))
	}
	data, err := io.ReadAll(io.LimitReader(file, int64(fileLimit)+1))
	if err != nil {
		return nil, fmt.Errorf("read uploaded file: %w", err)
	}
	return &media.Upload{ContentType: file.ContentType, Data: data}, nil
}

type Handler struct {
	service *media.Service
	resp    *response.Builder
}

func NewHandler(service *media.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "upload.friendLinkLogo", Method: http.MethodPut, Path: "/uploads/small/friend-link/logo", Summary: "Upload the logo of a friend link", Tags: tags, Access: httpapi.AccessAdmin, MaxBodyBytes: BodyLimit(media.FriendLinkLogoMaxBytes)}, h.friendLinkLogo)
	httpapi.Register(api, httpapi.Route{ID: "upload.adBanner", Method: http.MethodPut, Path: "/uploads/small/ad/banner", Summary: "Upload the 6:1 banner of an ad", Tags: tags, Access: httpapi.AccessAdmin, MaxBodyBytes: BodyLimit(media.AdImageMaxBytes)}, h.adBanner)
	httpapi.Register(api, httpapi.Route{ID: "upload.adSideImage", Method: http.MethodPut, Path: "/uploads/small/ad/side-image", Summary: "Upload the sidebar image of an ad", Tags: tags, Access: httpapi.AccessAdmin, MaxBodyBytes: BodyLimit(media.AdImageMaxBytes)}, h.adSideImage)
	httpapi.Register(api, httpapi.Route{ID: "upload.adSideIcon", Method: http.MethodPut, Path: "/uploads/small/ad/side-icon", Summary: "Upload the square icon an ad shows in the collapsed sidebar", Tags: tags, Access: httpapi.AccessAdmin, MaxBodyBytes: BodyLimit(media.AdImageMaxBytes)}, h.adSideIcon)
}

func (h *Handler) adBanner(ctx context.Context, in *adImageInput) (*response.Output[UploadedImageDTO], error) {
	return h.storeAdImage(ctx, in, h.service.StoreAdBanner)
}

func (h *Handler) adSideImage(ctx context.Context, in *adImageInput) (*response.Output[UploadedImageDTO], error) {
	return h.storeAdImage(ctx, in, h.service.StoreAdSideImage)
}

func (h *Handler) adSideIcon(ctx context.Context, in *adImageInput) (*response.Output[UploadedImageDTO], error) {
	return h.storeAdImage(ctx, in, h.service.StoreAdSideIcon)
}

func (h *Handler) storeAdImage(ctx context.Context, in *adImageInput, store func(context.Context, int, *media.Upload) (string, error)) (*response.Output[UploadedImageDTO], error) {
	upload, err := ReadUpload(in.RawBody.Data().File, media.AdImageMaxBytes)
	if err != nil {
		return nil, err
	}
	key, err := store(ctx, actor.From(ctx).UserID, upload)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, UploadedImageDTO{Key: key}), nil
}

func (h *Handler) friendLinkLogo(ctx context.Context, in *friendLinkLogoInput) (*response.Output[UploadedImageDTO], error) {
	upload, err := ReadUpload(in.RawBody.Data().File, media.FriendLinkLogoMaxBytes)
	if err != nil {
		return nil, err
	}
	key, err := h.service.StoreFriendLinkLogo(ctx, actor.From(ctx).UserID, upload)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, UploadedImageDTO{Key: key}), nil
}
