package logger_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"go.opentelemetry.io/otel/trace"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/logger"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
)

func decode(t *testing.T, buf *bytes.Buffer) map[string]any {
	t.Helper()
	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("decode %q: %v", buf.String(), err)
	}
	return line
}

func TestSensitiveAttributesAreRedacted(t *testing.T) {
	var buf bytes.Buffer
	log := logger.New(&buf, logger.Options{Level: slog.LevelInfo, Service: "api", Version: "test"})
	log.Info("login",
		slog.String("password", "hunter2"),
		slog.String("refresh_token", "abc"),
		slog.String("Authorization", "Bearer x"),
		slog.String("set_cookie", "a=b"),
		slog.String("client_secret", "s"),
		slog.String("user", "alice"),
	)
	line := decode(t, &buf)
	for _, key := range []string{"password", "refresh_token", "Authorization", "set_cookie", "client_secret"} {
		if line[key] != "[REDACTED]" {
			t.Fatalf("%s leaked: %v", key, line[key])
		}
	}
	if line["user"] != "alice" || line["service"] != "api" || line["version"] != "test" {
		t.Fatalf("line %v", line)
	}
}

func TestRequestScopedFieldsComeFromTheContext(t *testing.T) {
	var buf bytes.Buffer
	log := logger.New(&buf, logger.Options{Level: slog.LevelInfo})
	traceID, _ := trace.TraceIDFromHex("4bf92f3577b34da6a3ce929d0e0e4736")
	spanID, _ := trace.SpanIDFromHex("00f067aa0ba902b7")
	ctx := trace.ContextWithSpanContext(context.Background(), trace.NewSpanContext(trace.SpanContextConfig{TraceID: traceID, SpanID: spanID, TraceFlags: trace.FlagsSampled}))
	ctx = requestid.With(ctx, "req-12345678")
	ctx = logger.WithAttrs(ctx, slog.Int("user_id", 7))
	log.InfoContext(ctx, "hello")
	line := decode(t, &buf)
	if line["request_id"] != "req-12345678" || line["user_id"] != float64(7) || line["trace_id"] != traceID.String() || line["span_id"] != spanID.String() {
		t.Fatalf("line %v", line)
	}
}

func TestParseLevelFallsBackToInfo(t *testing.T) {
	if logger.ParseLevel(" debug ") != slog.LevelDebug || logger.ParseLevel("warn") != slog.LevelWarn || logger.ParseLevel("loud") != slog.LevelInfo {
		t.Fatal("unexpected levels")
	}
}
