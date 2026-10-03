package middleware

import (
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/telemetry"
)

func Trace(quietPaths []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isQuiet(r.URL.Path, quietPaths) {
				next.ServeHTTP(w, r)
				return
			}
			ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
			ctx, span := telemetry.Tracer().Start(ctx, "HTTP "+r.Method, trace.WithSpanKind(trace.SpanKindServer))
			defer span.End()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
