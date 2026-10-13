package healthhttp_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/healthhttp"
)

type pinger struct {
	err error
}

func (p pinger) Ping(context.Context) error {
	return p.err
}

type health struct {
	Status string            `json:"status"`
	Checks map[string]string `json:"checks"`
}

func setup(t *testing.T, checks map[string]healthhttp.Pinger) *apitest.Server {
	t.Helper()
	server := apitest.New(t)
	healthhttp.NewHandler(server.Builder, time.Second, checks).Register(server.API)
	return server
}

func TestReadinessReportsEveryCheck(t *testing.T) {
	server := setup(t, map[string]healthhttp.Pinger{"db": pinger{}, "redis": pinger{}})
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/health"})
	server.Expect(resp, http.StatusOK, 0)
	var got health
	resp.Decode(t, &got)
	if got.Status != "ok" || got.Checks["db"] != "up" || got.Checks["redis"] != "up" {
		t.Fatalf("health %s", resp.Data)
	}
}

func TestReadinessFailsWhenADependencyIsDown(t *testing.T) {
	server := setup(t, map[string]healthhttp.Pinger{"db": pinger{}, "redis": pinger{err: errors.New("connection refused")}})
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/health"})
	server.Expect(resp, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
}

func TestLivenessIgnoresDependencies(t *testing.T) {
	server := setup(t, map[string]healthhttp.Pinger{"db": pinger{err: errors.New("down")}})
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/health/live"})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"status":"ok"}` {
		t.Fatalf("liveness %s", resp.Data)
	}
}
