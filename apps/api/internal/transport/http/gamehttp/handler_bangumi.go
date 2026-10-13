package gamehttp

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const (
	bangumiOutcomeParam  = "bangumi"
	bangumiAuthorized    = "authorized"
	bangumiNotAuthorized = "failed"
)

var bangumiAdminTags = []string{"admin", "bangumi"}

type BangumiHandler struct {
	service *game.BangumiLinkService
	resp    *response.Builder
	siteURL string
	logger  *slog.Logger
}

func NewBangumiHandler(service *game.BangumiLinkService, resp *response.Builder, siteURL string, logger *slog.Logger) *BangumiHandler {
	return &BangumiHandler{service: service, resp: resp, siteURL: strings.TrimSuffix(siteURL, "/"), logger: logger}
}

func (h *BangumiHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminBangumi.authorization", Method: http.MethodGet, Path: "/admin/bangumi/authorization", Summary: "Whether the site may call Bangumi", Tags: bangumiAdminTags, Access: httpapi.AccessAdmin}, h.authorization)
	httpapi.Register(api, httpapi.Route{ID: "adminBangumi.start", Method: http.MethodGet, Path: "/admin/bangumi/authorization/start", Summary: "Redirect to Bangumi to authorize the site", Tags: bangumiAdminTags, Access: httpapi.AccessSuperAdmin, Status: http.StatusFound}, h.start)
	httpapi.Register(api, httpapi.Route{ID: "adminBangumi.callback", Method: http.MethodGet, Path: "/admin/bangumi/authorization/callback", Summary: "Complete the Bangumi authorization", Tags: bangumiAdminTags, Access: httpapi.AccessSuperAdmin, Status: http.StatusFound}, h.callback)
}

func (h *BangumiHandler) authorization(ctx context.Context, _ *struct{}) (*response.Output[bangumiAuthorizationDTO], error) {
	status, err := h.service.Status(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, bangumiAuthorizationDTO{
		Configured:  status.Configured,
		Authorized:  status.Authorized,
		ExpiresAt:   status.ExpiresAt,
		CallbackURL: status.CallbackURL,
	}), nil
}

func (h *BangumiHandler) start(ctx context.Context, in *bangumiStartInput) (*bangumiRedirectDTO, error) {
	location, err := h.service.Start(ctx, in.ReturnTo)
	if err != nil {
		return nil, err
	}
	return &bangumiRedirectDTO{Location: location}, nil
}

func (h *BangumiHandler) callback(ctx context.Context, in *bangumiCallbackInput) (*bangumiRedirectDTO, error) {
	returnTo, err := h.service.Complete(ctx, in.State, in.Code)
	if err != nil && returnTo == "" {
		return nil, err
	}
	outcome := bangumiAuthorized
	if err != nil {
		outcome = bangumiNotAuthorized
		h.logger.WarnContext(ctx, "bangumi authorization failed", slog.Any("error", err))
	}
	return &bangumiRedirectDTO{Location: h.siteURL + withOutcome(returnTo, outcome)}, nil
}

func withOutcome(path, outcome string) string {
	target, err := url.Parse(path)
	if err != nil {
		return path
	}
	query := target.Query()
	query.Set(bangumiOutcomeParam, outcome)
	target.RawQuery = query.Encode()
	return target.String()
}
