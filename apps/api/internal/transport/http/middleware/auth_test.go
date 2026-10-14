package middleware_test

import (
	"net/http/httptest"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
)

func TestAnAPIKeyIsNotTakenForAnAccessToken(t *testing.T) {
	cases := map[string]string{
		"Bearer user-token": "user-token",
		"Bearer shl_abc":    "",
		"Bearer undefined":  "",
	}
	for header, want := range cases {
		req := httptest.NewRequest("GET", "/x", nil)
		req.Header.Set("Authorization", header)
		if got := middleware.ExtractAccessToken(req); got != want {
			t.Fatalf("%q: got %q, want %q", header, got, want)
		}
	}
}
