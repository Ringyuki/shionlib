package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
)

const DefaultThrottle = "default"

type RateLimiter interface {
	Allow(ctx context.Context, policy ratelimit.Policy, key string) (ratelimit.Decision, error)
}

type Throttling struct {
	Limiter  RateLimiter
	Policies map[string]ratelimit.Policy
}

func (a *API) throttleMiddleware(name, method, path string) func(huma.Context, func(huma.Context)) {
	policy, ok := a.throttling.Policies[name]
	if !ok {
		panic("httpapi: unknown throttle policy " + name)
	}
	route := method + " " + path
	return func(ctx huma.Context, next func(huma.Context)) {
		requestCtx := ctx.Context()
		key := route + "|" + clientinfo.From(requestCtx).IP
		decision, err := a.throttling.Limiter.Allow(requestCtx, policy, key)
		if err != nil {
			a.logger.WarnContext(requestCtx, "rate limiter unavailable; allowing request", slog.String("policy", name), slog.Any("error", err))
			next(ctx)
			return
		}
		ctx.SetHeader("X-RateLimit-Limit", strconv.Itoa(decision.Limit))
		ctx.SetHeader("X-RateLimit-Remaining", strconv.Itoa(decision.Remaining))
		ctx.SetHeader("X-RateLimit-Reset", strconv.FormatInt(int64(decision.ResetAfter.Seconds()+0.999), 10))
		if !decision.Allowed {
			retryAfter := strconv.FormatInt(int64(decision.RetryAfter.Seconds()+0.999), 10)
			ctx.SetHeader("Retry-After", retryAfter)
			ctx.SetHeader("Retry-After-"+policy.Name, retryAfter)
			a.writeErr(ctx, a.mapper.FromStatus(requestCtx, http.StatusTooManyRequests, nil))
			return
		}
		next(ctx)
	}
}
