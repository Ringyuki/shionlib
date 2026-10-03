package response_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var now = time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)

func newBuilder(t *testing.T) *response.Builder {
	t.Helper()
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	return response.NewBuilder(catalog, func() time.Time { return now })
}

func TestOKFillsTheEnvelope(t *testing.T) {
	ctx := requestid.With(context.Background(), "req-12345678")
	out := response.OK(ctx, newBuilder(t), 42)
	if out.Body.Code != response.CodeSuccess || out.Body.Message != "" || out.Body.Data != 42 || out.Body.RequestID != "req-12345678" || !out.Body.Timestamp.Equal(now) || out.Body.Meta != nil || out.AuthStale != "" {
		t.Fatalf("envelope %+v", out)
	}
}

func TestStaleOptionalTokensAreReported(t *testing.T) {
	ctx := response.WithStaleToken(context.Background(), "expired")
	if reason, ok := response.StaleToken(ctx); !ok || reason != "expired" {
		t.Fatalf("stale token %q %v", reason, ok)
	}
	out := response.Empty(ctx, newBuilder(t))
	if out.AuthStale != "1" || out.Body.Meta == nil || out.Body.Meta.Auth == nil || !out.Body.Meta.Auth.OptionalTokenStale || out.Body.Meta.Auth.OptionalTokenReason != "expired" {
		t.Fatalf("empty envelope %+v", out)
	}
}

func TestMessagesAreTranslatedForTheRequestLocale(t *testing.T) {
	ctx := i18n.WithLocale(context.Background(), i18n.LocaleEN)
	out := response.Message(ctx, newBuilder(t), "common.error", nil, struct{}{})
	if out.Body.Message == "" || out.Body.Message == "common.error" || out.Body.Message == "请求失败" {
		t.Fatalf("message %q", out.Body.Message)
	}
}

func TestPagesComputeTheirMeta(t *testing.T) {
	page := response.NewPage([]int{1, 2}, 5, 2, 1)
	if page.Meta != (response.PageMeta{TotalItems: 5, ItemCount: 2, ItemsPerPage: 2, TotalPages: 3, CurrentPage: 1}) {
		t.Fatalf("meta %+v", page.Meta)
	}
	mapped := response.MapPage([]int{3}, 1, 10, 1, func(v int) string { return string(rune('a' + v)) })
	if len(mapped.Items) != 1 || mapped.Items[0] != "d" || mapped.Meta.TotalPages != 1 {
		t.Fatalf("mapped %+v", mapped)
	}
	if empty := response.NewPage[int](nil, 0, 10, 1); empty.Items == nil || empty.Meta.TotalPages != 0 {
		t.Fatalf("empty pages serialize items as [] %+v", empty)
	}
}
