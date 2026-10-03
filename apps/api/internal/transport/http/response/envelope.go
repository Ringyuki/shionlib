package response

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
)

const (
	CodeSuccess       = 0
	successMessageKey = "common.success"
)

type Envelope[T any] struct {
	Code      int       `json:"code"`
	Message   string    `json:"message"`
	Data      T         `json:"data"`
	RequestID string    `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
	Meta      *Meta     `json:"meta,omitempty"`
}

type Meta struct {
	Auth *AuthMeta `json:"auth,omitempty"`
}

type AuthMeta struct {
	OptionalTokenStale  bool   `json:"optionalTokenStale"`
	OptionalTokenReason string `json:"optionalTokenReason"`
}

type Output[T any] struct {
	AuthStale string `header:"shionlib-auth-stale"`
	Body      Envelope[T]
}

type EmptyEnvelope struct {
	Code      int       `json:"code"`
	Message   string    `json:"message"`
	RequestID string    `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
	Meta      *Meta     `json:"meta,omitempty"`
}

type EmptyOutput struct {
	AuthStale string `header:"shionlib-auth-stale"`
	Body      EmptyEnvelope
}

type Builder struct {
	catalog *i18n.Catalog
	now     func() time.Time
}

func NewBuilder(catalog *i18n.Catalog, now func() time.Time) *Builder {
	return &Builder{catalog: catalog, now: now}
}

func OK[T any](ctx context.Context, b *Builder, data T) *Output[T] {
	return Message(ctx, b, successMessageKey, nil, data)
}

func Message[T any](ctx context.Context, b *Builder, key string, args map[string]any, data T) *Output[T] {
	meta := metaFrom(ctx)
	return &Output[T]{AuthStale: staleHeader(meta), Body: Envelope[T]{
		Code:      CodeSuccess,
		Message:   b.Translate(ctx, key, args),
		Data:      data,
		RequestID: requestid.From(ctx),
		Timestamp: b.Now(),
		Meta:      meta,
	}}
}

func Empty(ctx context.Context, b *Builder) *EmptyOutput {
	meta := metaFrom(ctx)
	return &EmptyOutput{AuthStale: staleHeader(meta), Body: EmptyEnvelope{
		Code:      CodeSuccess,
		Message:   b.Translate(ctx, successMessageKey, nil),
		RequestID: requestid.From(ctx),
		Timestamp: b.Now(),
		Meta:      meta,
	}}
}

func staleHeader(meta *Meta) string {
	if meta == nil {
		return ""
	}
	return "1"
}

func (b *Builder) Translate(ctx context.Context, key string, args map[string]any) string {
	locale, ok := i18n.FromContext(ctx)
	if !ok {
		locale = b.catalog.Fallback()
	}
	return b.catalog.T(locale, key, args)
}

func (b *Builder) Now() time.Time {
	return b.now().UTC().Truncate(time.Millisecond)
}

type staleKey struct{}

func WithStaleToken(ctx context.Context, reason string) context.Context {
	if reason == "" {
		reason = "invalid_token"
	}
	return context.WithValue(ctx, staleKey{}, reason)
}

func StaleToken(ctx context.Context) (string, bool) {
	reason, ok := ctx.Value(staleKey{}).(string)
	return reason, ok
}

func metaFrom(ctx context.Context) *Meta {
	reason, ok := StaleToken(ctx)
	if !ok {
		return nil
	}
	return &Meta{Auth: &AuthMeta{OptionalTokenStale: true, OptionalTokenReason: reason}}
}
