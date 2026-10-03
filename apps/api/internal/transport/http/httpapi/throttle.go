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
		if !a.admit(requestCtx, policy, route, ctx.SetHeader) {
			a.writeErr(ctx, a.mapper.FromStatus(requestCtx, http.StatusTooManyRequests, nil))
			return
		}
		next(ctx)
	}
}

func (a *API) Throttled(policy ratelimit.Policy, route string, next http.Handler) http.Handler {
	if a.throttling == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if !a.admit(ctx, policy, route, w.Header().Set) {
			a.writer.Write(w, r, a.mapper.FromStatus(ctx, http.StatusTooManyRequests, nil))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) admit(ctx context.Context, policy ratelimit.Policy, route string, setHeader func(name, value string)) bool {
	key := route + "|" + clientinfo.From(ctx).IP
	decision, err := a.throttling.Limiter.Allow(ctx, policy, key)
	if err != nil {
		a.logger.WarnContext(ctx, "rate limiter unavailable; allowing request", slog.String("policy", policy.Name), slog.Any("error", err))
		return true
	}
	setHeader("X-RateLimit-Limit", strconv.Itoa(decision.Limit))
	setHeader("X-RateLimit-Remaining", strconv.Itoa(decision.Remaining))
	setHeader("X-RateLimit-Reset", strconv.FormatInt(int64(decision.ResetAfter.Seconds()+0.999), 10))
	if decision.Allowed {
		return true
	}
	retryAfter := strconv.FormatInt(int64(decision.RetryAfter.Seconds()+0.999), 10)
	setHeader("Retry-After", retryAfter)
	setHeader("Retry-After-"+policy.Name, retryAfter)
	return false
}
