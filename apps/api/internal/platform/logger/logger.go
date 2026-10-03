package logger

import (
	"context"
	"io"
	"log/slog"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
)

type Format string

const (
	FormatJSON Format = "json"
	FormatText Format = "text"
)

type Options struct {
	Level   slog.Level
	Format  Format
	Service string
	Version string
}

const redacted = "[REDACTED]"

var sensitiveKeys = []string{
	"password",
	"passwd",
	"secret",
	"token",
	"cookie",
	"authorization",
	"credential",
	"api_key",
	"apikey",
	"private_key",
}

func New(w io.Writer, opts Options) *slog.Logger {
	handlerOptions := &slog.HandlerOptions{
		Level:       opts.Level,
		ReplaceAttr: redact,
	}
	var base slog.Handler
	if opts.Format == FormatText {
		base = slog.NewTextHandler(w, handlerOptions)
	} else {
		base = slog.NewJSONHandler(w, handlerOptions)
	}
	return slog.New(&contextHandler{next: base}).With(
		slog.String("service", opts.Service),
		slog.String("version", opts.Version),
	)
}

func ParseLevel(raw string) slog.Level {
	var level slog.Level
	if err := level.UnmarshalText([]byte(strings.ToUpper(strings.TrimSpace(raw)))); err != nil {
		return slog.LevelInfo
	}
	return level
}

func Sensitive(key string) bool {
	lowered := strings.ToLower(key)
	for _, candidate := range sensitiveKeys {
		if strings.Contains(lowered, candidate) {
			return true
		}
	}
	return false
}

func redact(_ []string, attr slog.Attr) slog.Attr {
	if Sensitive(attr.Key) {
		return slog.String(attr.Key, redacted)
	}
	return attr
}

type attrsKey struct{}

func WithAttrs(ctx context.Context, attrs ...slog.Attr) context.Context {
	existing, _ := ctx.Value(attrsKey{}).([]slog.Attr)
	merged := make([]slog.Attr, 0, len(existing)+len(attrs))
	merged = append(merged, existing...)
	merged = append(merged, attrs...)
	return context.WithValue(ctx, attrsKey{}, merged)
}

type contextHandler struct {
	next slog.Handler
}

func (h *contextHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}

func (h *contextHandler) Handle(ctx context.Context, record slog.Record) error {
	if id := requestid.From(ctx); id != "" {
		record.AddAttrs(slog.String("request_id", id))
	}
	if attrs, ok := ctx.Value(attrsKey{}).([]slog.Attr); ok {
		record.AddAttrs(attrs...)
	}
	return h.next.Handle(ctx, record)
}

func (h *contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &contextHandler{next: h.next.WithAttrs(attrs)}
}

func (h *contextHandler) WithGroup(name string) slog.Handler {
	return &contextHandler{next: h.next.WithGroup(name)}
}
