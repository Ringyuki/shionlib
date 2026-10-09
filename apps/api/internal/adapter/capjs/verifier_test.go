package capjs_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/capjs"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

var _ download.Challenge = (*capjs.Verifier)(nil)

func newVerifier(url string) *capjs.Verifier {
	return capjs.New(capjs.Options{URL: url, SiteKey: "site1", Secret: "sk-secret", Client: httpclient.New(httpclient.Options{Timeout: time.Second})})
}

func TestVerifyAsksTheSiteKeyEndpointWithSecretAndToken(t *testing.T) {
	var path string
	var got map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("unexpected request %s %s", r.Method, r.Header.Get("Content-Type"))
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"success":true}`))
	}))
	defer server.Close()

	verdict, err := newVerifier(server.URL+"/").Verify(t.Context(), "site1:id:token")
	if err != nil || !verdict.Success || len(verdict.ErrorCodes) != 0 {
		t.Fatalf("success: %+v %v", verdict, err)
	}
	if path != "/site1/siteverify" {
		t.Fatalf("path: %s", path)
	}
	if got["secret"] != "sk-secret" || got["response"] != "site1:id:token" {
		t.Fatalf("payload: %v", got)
	}
}

func TestVerifyTellsARefusedTokenFromABrokenSetup(t *testing.T) {
	cases := map[string]struct {
		status  int
		body    string
		reasons []string
		broken  bool
	}{
		"used or unknown token": {status: http.StatusNotFound, body: `{"success":false,"error":"Token not found"}`, reasons: []string{"Token not found"}},
		"expired token":         {status: http.StatusForbidden, body: `{"success":false,"error":"Token expired"}`, reasons: []string{"Token expired"}},
		"malformed token":       {status: http.StatusBadRequest, body: `{"success":false,"error":"Missing required parameters"}`, reasons: []string{"Missing required parameters"}},
		"refusal without text":  {status: http.StatusForbidden, body: `{"success":false}`, reasons: []string{"Forbidden"}},
		"wrong secret":          {status: http.StatusForbidden, body: `{"success":false,"error":"Invalid site key or secret"}`, broken: true},
		"unknown site key":      {status: http.StatusNotFound, body: `{"success":false,"error":"Invalid site key or secret"}`, broken: true},
		"server error":          {status: http.StatusInternalServerError, body: `{"success":false}`, broken: true},
		"not json":              {status: http.StatusOK, body: `<html>`, broken: true},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()
			verdict, err := newVerifier(server.URL).Verify(t.Context(), "site1:id:token")
			if tc.broken {
				if err == nil {
					t.Fatalf("expected an error, got %+v", verdict)
				}
				return
			}
			if err != nil || verdict.Success || !slices.Equal(verdict.ErrorCodes, tc.reasons) {
				t.Fatalf("refusal: %+v %v", verdict, err)
			}
		})
	}
}

func TestVerifyRefusesATokenOfAnotherSiteKeyWithoutAsking(t *testing.T) {
	asked := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		asked = true
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"success":false,"error":"Invalid site key or secret"}`))
	}))
	defer server.Close()
	for _, token := range []string{"other:id:token", "site10:id:token", "garbage", ""} {
		verdict, err := newVerifier(server.URL).Verify(t.Context(), token)
		if err != nil || verdict.Success || len(verdict.ErrorCodes) != 1 {
			t.Fatalf("%q: %+v %v", token, verdict, err)
		}
	}
	if asked {
		t.Fatal("cap was asked about a token that cannot be its own")
	}
}

func TestVerifyFailsWhenTheServerCannotBeReached(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	server.Close()
	if _, err := newVerifier(server.URL).Verify(t.Context(), "site1:id:token"); err == nil {
		t.Fatal("expected an error")
	}
}

func TestVerifyNeedsEverySetting(t *testing.T) {
	client := httpclient.New(httpclient.Options{Timeout: time.Second})
	for name, opts := range map[string]capjs.Options{
		"no url":      {SiteKey: "site1", Secret: "sk", Client: client},
		"no site key": {URL: "http://cap", Secret: "sk", Client: client},
		"no secret":   {URL: "http://cap", SiteKey: "site1", Client: client},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := capjs.New(opts).Verify(t.Context(), "site1:id:token"); !errors.Is(err, capjs.ErrNotConfigured) {
				t.Fatalf("expected ErrNotConfigured, got %v", err)
			}
		})
	}
}
