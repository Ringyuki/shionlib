package indexnow_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/indexnow"
	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

var _ indexing.Submitter = (*indexnow.Submitter)(nil)

func TestSubmitPostsTheAddressesWithTheKeyFile(t *testing.T) {
	var got map[string]any
	status := http.StatusAccepted
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			t.Errorf("unexpected request %s %s", r.Method, r.Header.Get("Content-Type"))
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(status)
	}))
	defer server.Close()
	key := indexnow.KeyFrom("secret")
	submitter := indexnow.New(indexnow.Options{Endpoint: server.URL, SiteURL: "https://shionlib.com", Key: key, Client: httpclient.New(httpclient.Options{Timeout: time.Second})})
	if err := submitter.Submit(context.Background(), []string{"https://shionlib.com/zh/resource/1"}); err != nil {
		t.Fatal(err)
	}
	if got["host"] != "shionlib.com" || got["key"] != key || got["keyLocation"] != "https://shionlib.com/indexnow.txt" || len(got["urlList"].([]any)) != 1 {
		t.Fatalf("unexpected submission %v", got)
	}
	if len(key) != 32 || key != indexnow.KeyFrom("secret") || key == indexnow.KeyFrom("other") {
		t.Fatalf("the key is stable per secret: %s", key)
	}
	status = http.StatusUnprocessableEntity
	if err := submitter.Submit(context.Background(), []string{"https://elsewhere.example/"}); err == nil {
		t.Fatal("a refusal is an error")
	}
}
