package middleware

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reqstate"
)

const LocaleCookie = "shionlib_locale"

func RequestContext(resolver *clientinfo.Resolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			info := resolver.Resolve(r)
			id := r.Header.Get(requestid.Header)
			if !info.Trusted || !requestid.Acceptable(id) {
				id = requestid.New()
			}
			ctx := requestid.With(r.Context(), id)
			ctx = clientinfo.With(ctx, info)
			ctx, _ = reqstate.With(ctx)
			w.Header().Set(requestid.Header, id)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func Locale(catalog *i18n.Catalog) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(i18n.WithLocale(r.Context(), resolveLocale(r, catalog.Fallback()))))
		})
	}
}

func resolveLocale(r *http.Request, fallback i18n.Locale) i18n.Locale {
	if cookie, err := r.Cookie(LocaleCookie); err == nil {
		if locale, ok := i18n.Match(cookie.Value); ok {
			return locale
		}
	}
	if locale, ok := i18n.Match(r.URL.Query().Get("lang")); ok {
		return locale
	}
	if locale, ok := i18n.MatchAcceptLanguage(r.Header.Get("Accept-Language")); ok {
		return locale
	}
	return fallback
}

func Recover(mapper *errmap.Mapper, writer *errmap.Writer, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				recovered := recover()
				if recovered == nil {
					return
				}
				if err, ok := recovered.(error); ok && errors.Is(err, http.ErrAbortHandler) {
					panic(recovered)
				}
				err := fmt.Errorf("panic: %v", recovered)
				logger.ErrorContext(r.Context(), "panic recovered",
					slog.Any("error", err),
					slog.String("stack", string(debug.Stack())),
				)
				writer.Write(w, r, mapper.FromError(r.Context(), err))
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func AccessLog(logger *slog.Logger, quietPaths []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)

			ctx := r.Context()
			route := chi.RouteContext(ctx)
			pattern := r.URL.Path
			if route != nil && route.RoutePattern() != "" {
				pattern = route.RoutePattern()
			}
			attrs := []slog.Attr{
				slog.String("method", r.Method),
				slog.String("route", pattern),
				slog.Int("status", recorder.status),
				slog.Int64("duration_ms", time.Since(start).Milliseconds()),
				slog.String("ip", clientinfo.From(ctx).IP),
			}
			level := slog.LevelInfo
			if state := reqstate.From(ctx); state != nil {
				if userID := state.UserID(); userID > 0 {
					attrs = append(attrs, slog.Int("user_id", userID))
				}
				if snapshot := state.Snapshot(); snapshot.HasError {
					attrs = append(attrs, slog.Int("business_code", snapshot.BizCode))
					if recorder.status >= http.StatusInternalServerError && snapshot.Err != nil {
						attrs = append(attrs, slog.String("error", snapshot.Err.Error()))
					}
				}
			}
			switch {
			case recorder.status == errmap.StatusClientClosedRequest:
				level = slog.LevelInfo
			case recorder.status >= http.StatusInternalServerError:
				level = slog.LevelError
			case recorder.status >= http.StatusBadRequest && recorder.status != http.StatusUnauthorized:
				level = slog.LevelWarn
			case isQuiet(r.URL.Path, quietPaths):
				level = slog.LevelDebug
			}
			annotateSpan(ctx, r.Method, pattern, recorder.status)
			logger.LogAttrs(ctx, level, "http request", attrs...)
		})
	}
}

func isQuiet(path string, quietPaths []string) bool {
	for _, quiet := range quietPaths {
		if path == quiet || strings.HasPrefix(path, quiet+"/") {
			return true
		}
	}
	return false
}

type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (r *statusRecorder) WriteHeader(status int) {
	if !r.wroteHeader {
		r.status = status
		r.wroteHeader = true
	}
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		r.wroteHeader = true
	}
	return r.ResponseWriter.Write(b)
}

func (r *statusRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("response writer does not support hijacking")
	}
	return hijacker.Hijack()
}

func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

func annotateSpan(ctx context.Context, method, route string, status int) {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}
	span.SetName(method + " " + route)
	span.SetAttributes(
		attribute.String("http.request.method", method),
		attribute.String("http.route", route),
		attribute.Int("http.response.status_code", status),
		attribute.String("shionlib.request_id", requestid.From(ctx)),
	)
	if status >= http.StatusInternalServerError {
		span.SetStatus(codes.Error, http.StatusText(status))
	}
}
