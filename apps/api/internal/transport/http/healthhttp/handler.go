package healthhttp

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type Pinger interface {
	Ping(ctx context.Context) error
}

type Check struct {
	Name   string
	Pinger Pinger
}

type Handler struct {
	checks  []Check
	builder *response.Builder
	timeout time.Duration
}

func NewHandler(builder *response.Builder, timeout time.Duration, checks ...Check) *Handler {
	return &Handler{checks: checks, builder: builder, timeout: timeout}
}

type Status struct {
	Status    string            `json:"status" enum:"ok,error"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks"`
	LatencyMs int64             `json:"latencyMs"`
}

type liveness struct {
	Status string `json:"status"`
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "health.get", Method: http.MethodGet, Path: "/health", Summary: "Readiness probe", Tags: []string{"health"}}, h.readiness)
	httpapi.Register(api, httpapi.Route{ID: "health.live", Method: http.MethodGet, Path: "/health/live", Summary: "Liveness probe", Tags: []string{"health"}}, h.liveness)
}

func (h *Handler) readiness(ctx context.Context, _ *struct{}) (*response.Output[Status], error) {
	start := time.Now()
	checkCtx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()
	status := Status{Status: "ok", Checks: make(map[string]string, len(h.checks))}
	var failures []error
	for _, check := range h.checks {
		if err := check.Pinger.Ping(checkCtx); err != nil {
			status.Checks[check.Name] = "down"
			failures = append(failures, err)
			continue
		}
		status.Checks[check.Name] = "up"
	}
	status.Timestamp = h.builder.Now()
	status.LatencyMs = time.Since(start).Milliseconds()
	if len(failures) > 0 {
		return nil, errmap.WithStatus(http.StatusServiceUnavailable, errors.Join(failures...))
	}
	return response.OK(ctx, h.builder, status), nil
}

func (h *Handler) liveness(ctx context.Context, _ *struct{}) (*response.Output[liveness], error) {
	return response.OK(ctx, h.builder, liveness{Status: "ok"}), nil
}
