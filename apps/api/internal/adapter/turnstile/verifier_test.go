package turnstile_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/turnstile"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

var _ download.Challenge = (*turnstile.Verifier)(nil)

func TestVerifyPostsTokenAndSecret(t *testing.T) {
	var got map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("unexpected request %s %s", r.Method, r.Header.Get("Content-Type"))
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		if got["response"] == "good" {
			_, _ = w.Write([]byte(`{"success":true,"error-codes":[]}`))
			return
		}
		_, _ = w.Write([]byte(`{"success":false,"error-codes":["invalid-input-response","timeout-or-duplicate"]}`))
	}))
	defer server.Close()
	verifier := turnstile.New("s3cret", server.URL, httpclient.New(httpclient.Options{Timeout: time.Second}))

	ok, err := verifier.Verify(t.Context(), "good")
	if err != nil || !ok.Success || len(ok.ErrorCodes) != 0 {
		t.Fatalf("success: %+v %v", ok, err)
	}
	if got["secret"] != "s3cret" {
		t.Fatalf("secret not forwarded: %v", got)
	}
	bad, err := verifier.Verify(t.Context(), "bad")
	if err != nil || bad.Success || !slices.Equal(bad.ErrorCodes, []string{"invalid-input-response", "timeout-or-duplicate"}) {
		t.Fatalf("failure: %+v %v", bad, err)
	}
}

func TestVerifyFailures(t *testing.T) {
	cases := map[string]struct {
		status int
		body   string
	}{
		"server error": {status: http.StatusInternalServerError, body: `{}`},
		"malformed":    {status: http.StatusOK, body: `not json`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()
			verifier := turnstile.New("s", server.URL, httpclient.New(httpclient.Options{Timeout: time.Second}))
			if _, err := verifier.Verify(t.Context(), "x"); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
	if turnstile.DefaultURL != "https://challenges.cloudflare.com/turnstile/v0/siteverify" {
		t.Fatal("default endpoint changed")
	}
}
