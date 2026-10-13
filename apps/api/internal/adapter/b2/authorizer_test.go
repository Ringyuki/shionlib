package b2_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/b2"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/cache"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

var (
	_ download.Authorizer = (*b2.Authorizer)(nil)
	_ b2.Cache            = (*cache.Cache)(nil)
)

type memoryCache struct {
	mu      sync.Mutex
	entries map[string][]byte
	ttls    map[string]time.Duration
}

func newMemoryCache() *memoryCache {
	return &memoryCache{entries: map[string][]byte{}, ttls: map[string]time.Duration{}}
}

func (c *memoryCache) Get(_ context.Context, key string, dst any) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, ok := c.entries[key]
	if !ok {
		return false, nil
	}
	return true, json.Unmarshal(raw, dst)
}

func (c *memoryCache) Set(_ context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = raw
	c.ttls[key] = ttl
	return nil
}

func (c *memoryCache) Delete(_ context.Context, keys ...string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, key := range keys {
		delete(c.entries, key)
	}
	return nil
}

type fakeB2 struct {
	server        *httptest.Server
	accountCalls  atomic.Int32
	downloadCalls atomic.Int32
	rejectTokens  atomic.Int32
	failDownloads atomic.Bool
	tokenVersion  atomic.Int32
	mu            sync.Mutex
	lastRequest   map[string]any
	lastAuth      string
}

func newFakeB2(t *testing.T) *fakeB2 {
	t.Helper()
	fake := &fakeB2{}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth", func(w http.ResponseWriter, r *http.Request) {
		fake.accountCalls.Add(1)
		if r.Header.Get("Authorization") != "Basic "+base64.StdEncoding.EncodeToString([]byte("key-id:secret")) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		version := fake.tokenVersion.Add(1)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"authorizationToken": "account-" + strconv.Itoa(int(version)),
			"apiInfo": map[string]any{"storageApi": map[string]any{
				"apiUrl":      fake.server.URL + "/api/",
				"downloadUrl": "https://f005.backblazeb2.com",
				"allowed":     map[string]any{"buckets": []map[string]any{{"id": "bucket-id", "name": "game-bucket"}}},
			}},
		})
	})
	mux.HandleFunc("POST /api/b2api/v4/b2_get_download_authorization", func(w http.ResponseWriter, r *http.Request) {
		fake.downloadCalls.Add(1)
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		fake.mu.Lock()
		fake.lastRequest = body
		fake.lastAuth = r.Header.Get("Authorization")
		fake.mu.Unlock()
		if fake.rejectTokens.Load() > 0 {
			fake.rejectTokens.Add(-1)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if fake.failDownloads.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"authorizationToken": "download-token"})
	})
	fake.server = httptest.NewServer(mux)
	t.Cleanup(fake.server.Close)
	return fake
}

func newAuthorizer(fake *fakeB2, store b2.Cache) *b2.Authorizer {
	return b2.New(b2.Options{KeyID: "key-id", Key: "secret", AuthURL: fake.server.URL + "/auth", Client: httpclient.New(httpclient.Options{Timeout: time.Second}), Cache: store})
}

func TestAuthorizeAndReuseAccount(t *testing.T) {
	fake := newFakeB2(t)
	store := newMemoryCache()
	authorizer := newAuthorizer(fake, store)
	auth, err := authorizer.Authorize(t.Context(), "games/1/2/a b.7z", 90*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	want := download.Authorization{BucketName: "game-bucket", FileKey: "games/1/2/a b.7z", Token: "download-token", DownloadURL: "https://f005.backblazeb2.com"}
	if auth != want {
		t.Fatalf("got %+v", auth)
	}
	fake.mu.Lock()
	request, header := fake.lastRequest, fake.lastAuth
	fake.mu.Unlock()
	if request["bucketId"] != "bucket-id" || request["fileNamePrefix"] != "games/1/2/a b.7z" || request["validDurationInSeconds"] != float64(5400) || header != "account-1" {
		t.Fatalf("unexpected download request %v %s", request, header)
	}
	if _, err := authorizer.Authorize(t.Context(), "k", time.Hour); err != nil {
		t.Fatal(err)
	}
	if fake.accountCalls.Load() != 1 {
		t.Fatalf("account must be cached, calls %d", fake.accountCalls.Load())
	}
	if store.ttls["download:b2:account"] != 21*time.Hour {
		t.Fatalf("unexpected ttl %v", store.ttls)
	}
}

func TestAuthorizeRetriesOnceAfterRejectedToken(t *testing.T) {
	fake := newFakeB2(t)
	authorizer := newAuthorizer(fake, newMemoryCache())
	if _, err := authorizer.Authorize(t.Context(), "k", time.Hour); err != nil {
		t.Fatal(err)
	}
	fake.rejectTokens.Store(1)
	auth, err := authorizer.Authorize(t.Context(), "k", time.Hour)
	if err != nil || auth.Token != "download-token" {
		t.Fatalf("retry: %+v %v", auth, err)
	}
	if fake.accountCalls.Load() != 2 {
		t.Fatalf("account must be refreshed once, calls %d", fake.accountCalls.Load())
	}
	fake.mu.Lock()
	header := fake.lastAuth
	fake.mu.Unlock()
	if header != "account-2" {
		t.Fatalf("retry must use the refreshed token, got %s", header)
	}
	fake.rejectTokens.Store(2)
	if _, err := authorizer.Authorize(t.Context(), "k", time.Hour); err == nil {
		t.Fatal("a second rejection must fail")
	}
}

func TestAuthorizeErrors(t *testing.T) {
	fake := newFakeB2(t)
	fake.failDownloads.Store(true)
	if _, err := newAuthorizer(fake, newMemoryCache()).Authorize(t.Context(), "k", time.Hour); err == nil {
		t.Fatal("non-2xx download authorization must fail")
	}
	wrongKey := b2.New(b2.Options{KeyID: "key-id", Key: "wrong", AuthURL: fake.server.URL + "/auth", Client: httpclient.New(httpclient.Options{Timeout: time.Second}), Cache: newMemoryCache()})
	if _, err := wrongKey.Authorize(t.Context(), "k", time.Hour); err == nil {
		t.Fatal("account rejection must fail")
	}
	noBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"authorizationToken":"t","apiInfo":{"storageApi":{"apiUrl":"x","downloadUrl":"y","allowed":{"buckets":[]}}}}`))
	}))
	defer noBucket.Close()
	unrestricted := b2.New(b2.Options{KeyID: "a", Key: "b", AuthURL: noBucket.URL, Client: httpclient.New(httpclient.Options{Timeout: time.Second}), Cache: newMemoryCache()})
	if _, err := unrestricted.Authorize(t.Context(), "k", time.Hour); err == nil {
		t.Fatal("keys without a bucket restriction must fail")
	}
}
