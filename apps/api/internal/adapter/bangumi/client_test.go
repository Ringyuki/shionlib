package bangumi_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/bangumi"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type memoryTokens struct {
	mu  sync.Mutex
	raw []byte
}

func (m *memoryTokens) Load(context.Context) ([]byte, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.raw, m.raw != nil, nil
}

func (m *memoryTokens) Save(_ context.Context, raw []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.raw = raw
	return nil
}

var now = time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)

func upstream(t *testing.T, refreshes *atomic.Int32) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		refreshes.Add(1)
		if err := r.ParseForm(); err != nil || r.PostForm.Get("grant_type") != "refresh_token" || r.PostForm.Get("refresh_token") != "refresh-1" || r.PostForm.Get("client_id") != "id" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		time.Sleep(20 * time.Millisecond)
		_, _ = w.Write([]byte(`{"access_token":"fresh","refresh_token":"refresh-2","expires_in":604800}`))
	})
	mux.HandleFunc("GET /v0/subjects/42", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer fresh" && r.Header.Get("Authorization") != "Bearer valid" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"id":42,"name":"x","rating":{"rank":12,"total":300,"count":{"1":1,"10":5},"score":7.9}}`))
	})
	mux.HandleFunc("GET /v0/characters/7/persons", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`[{"id":1}]`))
	})
	mux.HandleFunc("GET /v0/subjects/404", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func newClient(server *httptest.Server, store *memoryTokens) *bangumi.Client {
	return bangumi.NewClient(bangumi.Options{
		HTTP: server.Client(), APIBaseURL: server.URL, TokenURL: server.URL + "/oauth/access_token",
		ClientID: "id", ClientSecret: "secret", Tokens: store, Now: func() time.Time { return now },
	})
}

func TestExpiredTokensAreRefreshedOnceAndPersisted(t *testing.T) {
	var refreshes atomic.Int32
	server := upstream(t, &refreshes)
	store := &memoryTokens{raw: []byte(`{"access_token":"stale","refresh_token":"refresh-1","expires_at":` + jsonInt(now.Add(time.Minute).UnixMilli()) + `}`)}
	client := newClient(server, store)

	var wg sync.WaitGroup
	errs := make(chan error, 5)
	for range 5 {
		wg.Go(func() {
			score, err := client.Subject(context.Background(), "42")
			if err == nil && (score.ID != 42 || score.Rating.Rank != 12 || score.Rating.Count["10"] != 5 || score.Rating.Score != 7.9) {
				err = errors.New("unexpected score")
			}
			errs <- err
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if refreshes.Load() != 1 {
		t.Fatalf("concurrent requests must share one refresh, got %d", refreshes.Load())
	}
	var saved map[string]any
	if err := json.Unmarshal(store.raw, &saved); err != nil {
		t.Fatal(err)
	}
	if saved["access_token"] != "fresh" || saved["refresh_token"] != "refresh-2" || saved["token_type"] != "Bearer" || saved["expires_at"] != float64(now.Add(7*24*time.Hour).UnixMilli()) || saved["saved_at"] != float64(now.UnixMilli()) {
		t.Fatalf("persisted tokens keep the legacy file format: %+v", saved)
	}
}

func TestValidTokensAndErrors(t *testing.T) {
	var refreshes atomic.Int32
	server := upstream(t, &refreshes)
	store := &memoryTokens{raw: []byte(`{"access_token":"valid","refresh_token":"refresh-1","expires_at":` + jsonInt(now.Add(time.Hour).UnixMilli()) + `}`)}
	client := newClient(server, store)
	ctx := context.Background()

	raw, err := client.Resource(ctx, "characters/7/persons")
	if err != nil || string(raw) != `[{"id":1}]` || refreshes.Load() != 0 {
		t.Fatalf("resource: %s %v %d", raw, err, refreshes.Load())
	}
	if _, err := client.Subject(ctx, "404"); !errors.Is(err, game.ErrBangumiRequestFailed) {
		t.Fatalf("upstream status: %v", err)
	}
	empty := newClient(server, &memoryTokens{})
	if _, err := empty.Subject(ctx, "42"); !errors.Is(err, bangumi.ErrTokensMissing) {
		t.Fatalf("missing tokens: %v", err)
	}
}

func jsonInt(v int64) string {
	raw, _ := json.Marshal(v)
	return string(raw)
}
