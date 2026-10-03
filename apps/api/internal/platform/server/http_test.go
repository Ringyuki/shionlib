package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/server"
)

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) listening() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	for line := range strings.SplitSeq(b.buf.String(), "\n") {
		var entry struct {
			Msg  string `json:"msg"`
			Addr string `json:"addr"`
		}
		if json.Unmarshal([]byte(line), &entry) == nil && entry.Msg == "http server listening" {
			return entry.Addr
		}
	}
	return ""
}

func TestShutdownDrainsInFlightRequests(t *testing.T) {
	logs := &lockedBuffer{}
	entered := make(chan struct{})
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(entered)
		time.Sleep(100 * time.Millisecond)
		_, _ = io.WriteString(w, "done")
	})
	srv := server.NewHTTP(handler, server.HTTPOptions{Addr: "127.0.0.1:0", ReadHeaderTimeout: time.Second, ShutdownTimeout: 5 * time.Second}, slog.New(slog.NewJSONHandler(logs, nil)))
	ctx, cancel := context.WithCancel(t.Context())
	stopped := make(chan error, 1)
	go func() { stopped <- srv.Run(ctx) }()

	var addr string
	for deadline := time.Now().Add(3 * time.Second); addr == "" && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		addr = logs.listening()
	}
	if addr == "" {
		t.Fatal("server did not start")
	}
	body := make(chan string, 1)
	go func() {
		req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://"+addr, nil)
		resp, err := http.DefaultTransport.RoundTrip(req)
		if err != nil {
			body <- err.Error()
			return
		}
		defer func() { _ = resp.Body.Close() }()
		raw, _ := io.ReadAll(resp.Body)
		body <- string(raw)
	}()
	<-entered
	cancel()
	if got := <-body; got != "done" {
		t.Fatalf("in-flight request was cut: %q", got)
	}
	if err := <-stopped; err != nil {
		t.Fatalf("clean shutdown: %v", err)
	}
}

func TestListenFailuresAreReturned(t *testing.T) {
	srv := server.NewHTTP(http.NotFoundHandler(), server.HTTPOptions{Addr: "256.0.0.1:0"}, slog.New(slog.DiscardHandler))
	if err := srv.Run(t.Context()); err == nil {
		t.Fatal("expected a listen error")
	}
}
