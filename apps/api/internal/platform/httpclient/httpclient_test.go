package httpclient_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

func TestClientsAlwaysHaveATimeout(t *testing.T) {
	if client := httpclient.New(httpclient.Options{}); client.Timeout != 15*time.Second {
		t.Fatalf("default timeout %s", client.Timeout)
	}
	if client := httpclient.New(httpclient.Options{Timeout: time.Second}); client.Timeout != time.Second {
		t.Fatalf("configured timeout %s", client.Timeout)
	}
}

func TestSlowUpstreamsAreCutOff(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer server.Close()
	defer close(release)
	client := httpclient.New(httpclient.Options{Timeout: 50 * time.Millisecond})
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, server.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
		t.Fatal("expected a timeout")
	}
	if !errors.Is(err, os.ErrDeadlineExceeded) {
		var timeout interface{ Timeout() bool }
		if !errors.As(err, &timeout) || !timeout.Timeout() {
			t.Fatalf("expected a timeout error, got %v", err)
		}
	}
}
