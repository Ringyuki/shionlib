package healthhttp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type Handler struct {
	checks  map[string]Pinger
	builder *response.Builder
	timeout time.Duration
}

func NewHandler(builder *response.Builder, timeout time.Duration, checks map[string]Pinger) *Handler {
	return &Handler{checks: checks, builder: builder, timeout: timeout}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "health.get", Method: http.MethodGet, Path: "/health", Summary: "Readiness probe", Tags: []string{"health"}}, h.readiness)
	httpapi.Register(api, httpapi.Route{ID: "health.live", Method: http.MethodGet, Path: "/health/live", Summary: "Liveness probe", Tags: []string{"health"}}, h.liveness)
}

func (h *Handler) readiness(ctx context.Context, _ *struct{}) (*response.Output[HealthStatusDTO], error) {
	start := time.Now()
	checkCtx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()
	status := HealthStatusDTO{Status: "ok", Checks: make(map[string]string, len(h.checks))}
	var failures []error
	for name, pinger := range h.checks {
		if err := pinger.Ping(checkCtx); err != nil {
			status.Checks[name] = "down"
			failures = append(failures, fmt.Errorf("%s: %w", name, err))
			continue
		}
		status.Checks[name] = "up"
	}
	status.Timestamp = h.builder.Now()
	status.LatencyMs = time.Since(start).Milliseconds()
	if len(failures) > 0 {
		return nil, errmap.WithStatus(http.StatusServiceUnavailable, errors.Join(failures...))
	}
	return response.OK(ctx, h.builder, status), nil
}

func (h *Handler) liveness(ctx context.Context, _ *struct{}) (*response.Output[healthLivenessDTO], error) {
	return response.OK(ctx, h.builder, healthLivenessDTO{Status: "ok"}), nil
}

type Pinger interface {
	Ping(ctx context.Context) error
}
