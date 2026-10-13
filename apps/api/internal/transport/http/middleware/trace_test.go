package middleware_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/logger"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
)

func TestRequestsAreTracedPerRoute(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	previous, previousPropagator := otel.GetTracerProvider(), otel.GetTextMapPropagator()
	otel.SetTracerProvider(sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder)))
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() {
		otel.SetTracerProvider(previous)
		otel.SetTextMapPropagator(previousPropagator)
	})

	var logs bytes.Buffer
	log := logger.New(&logs, logger.Options{Format: logger.FormatJSON, Service: "test"})
	router := chi.NewRouter()
	router.Use(middleware.Trace([]string{"/health"}), middleware.AccessLog(log, []string{"/health"}))
	router.Get("/games/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) })
	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	for _, path := range []string{"/games/7", "/health"} {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
		req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
		router.ServeHTTP(httptest.NewRecorder(), req)
	}
	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("health checks are not traced: %d spans", len(spans))
	}
	span := spans[0]
	if span.Name() != "GET /games/{id}" || span.Status().Code.String() != "Error" || span.Parent().TraceID().String() != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("span %s %v %s", span.Name(), span.Status(), span.Parent().TraceID())
	}
	attrs := map[string]string{}
	for _, attr := range span.Attributes() {
		attrs[string(attr.Key)] = attr.Value.String()
	}
	if attrs["http.route"] != "/games/{id}" || attrs["http.response.status_code"] != "500" || attrs["http.request.method"] != "GET" {
		t.Fatalf("attributes %v", attrs)
	}
	line := strings.Split(logs.String(), "\n")[0]
	if !strings.Contains(line, `"trace_id":"4bf92f3577b34da6a3ce929d0e0e4736"`) || !strings.Contains(line, `"span_id":"`) {
		t.Fatalf("access log lines carry the trace id: %s", line)
	}
}
