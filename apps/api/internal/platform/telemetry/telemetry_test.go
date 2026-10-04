package telemetry_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/telemetry"
)

func TestSetupWithoutAnEndpointIsDisabled(t *testing.T) {
	tracing, err := telemetry.Setup(context.Background(), telemetry.Options{})
	if err != nil || tracing.Enabled() {
		t.Fatalf("telemetry %+v %v", tracing, err)
	}
	if err := tracing.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestSpansAreExportedToTheOTLPEndpoint(t *testing.T) {
	var mu sync.Mutex
	var paths, auths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		paths = append(paths, r.URL.Path)
		auths = append(auths, r.Header.Get("Authorization"))
		mu.Unlock()
		w.Header().Set("Content-Type", "application/x-protobuf")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)
	tracing, err := telemetry.Setup(context.Background(), telemetry.Options{
		Endpoint:    server.URL + "/",
		Headers:     map[string]string{"Authorization": "Bearer ingest-key"},
		SampleRate:  1,
		ServiceName: "shionlib-api",
		Version:     "test",
		Environment: "test",
	})
	if err != nil || !tracing.Enabled() {
		t.Fatalf("setup %v", err)
	}
	_, span := telemetry.Tracer().Start(context.Background(), "work")
	span.End()
	if err := tracing.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(paths) == 0 || paths[0] != "/v1/traces" || auths[0] != "Bearer ingest-key" {
		t.Fatalf("exports %v %v", paths, auths)
	}
}
