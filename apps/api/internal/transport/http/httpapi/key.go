package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reqstate"
)

const OpenPrefix = "/open/"

type KeyHolder struct {
	KeyID  int
	UserID int
	Limit  *int
}

type KeyAuthenticator interface {
	AuthenticateKey(ctx context.Context, secret, ip string) (KeyHolder, error)
	RecordKeyUse(ctx context.Context, holder KeyHolder, throttled bool) error
}

func (a *API) requireKey(throttle string) func(huma.Context, func(huma.Context)) {
	var policy func() ratelimitPolicy
	if a.throttling != nil {
		policy = a.throttling.policy(throttle)
	}
	return func(ctx huma.Context, next func(huma.Context)) {
		requestCtx := ctx.Context()
		holder, err := a.keys.AuthenticateKey(requestCtx, bearer(ctx.Header("Authorization")), clientinfo.From(requestCtx).IP)
		if err != nil {
			a.writeErr(ctx, a.mapper.FromError(requestCtx, err))
			return
		}
		reqstate.RecordUser(requestCtx, holder.UserID)
		reqstate.RecordKey(requestCtx, holder.KeyID)
		allowed := true
		if policy != nil {
			current := policy()
			if holder.Limit != nil {
				current.Limit = *holder.Limit
			}
			allowed = a.admitKey(requestCtx, current, holder.UserID, ctx.SetHeader)
		}
		if err := a.keys.RecordKeyUse(requestCtx, holder, !allowed); err != nil {
			a.logger.WarnContext(requestCtx, "API key use not counted", slog.Int("key_id", holder.KeyID), slog.Any("error", err))
		}
		if !allowed {
			a.writeErr(ctx, a.mapper.FromStatus(requestCtx, http.StatusTooManyRequests, nil))
			return
		}
		next(huma.WithContext(ctx, actor.With(requestCtx, actor.Actor{UserID: holder.UserID, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})))
	}
}

func (a *API) admitKey(ctx context.Context, policy ratelimitPolicy, userID int, setHeader func(name, value string)) bool {
	return a.admitAs(ctx, policy, "account|"+strconv.Itoa(userID), setHeader)
}

func bearer(header string) string {
	scheme, token, found := strings.Cut(strings.TrimSpace(header), " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}
