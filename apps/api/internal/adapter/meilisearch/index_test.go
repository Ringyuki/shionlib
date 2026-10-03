package meilisearch_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/meilisearch"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type recorded struct {
	method, path, auth string
	body               string
}

func TestIndexWritesDocumentsAndSettings(t *testing.T) {
	var mu sync.Mutex
	var calls []recorded
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		calls = append(calls, recorded{method: r.Method, path: r.URL.RequestURI(), auth: r.Header.Get("Authorization"), body: string(body)})
		mu.Unlock()
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"taskUid":1}`))
	}))
	t.Cleanup(server.Close)
	index := meilisearch.NewIndex(meilisearch.Options{HTTP: server.Client(), Host: server.URL + "/", APIKey: "key", Index: "shionlib_games"})
	ctx := context.Background()
	release := time.Date(2020, 4, 24, 0, 0, 0, 0, time.UTC)
	role := "开发"
	doc := search.Document{
		ID: 7, TitleJP: "サクラノ詩", Aliases: []string{"sakuuta"}, Tags: []string{"纯爱"}, NSFW: true, MaxCoverSexual: 2, ReleaseDate: &release,
		Developers:       []search.DocumentDeveloper{{ID: 5, Name: "枕", Role: &role, Aliases: []string{"Makura"}}},
		CharacterNamesJP: []string{"御桜稟"},
		Staffs:           []search.DocumentStaff{{Name: "すかぢ", Role: "剧本"}},
	}
	if err := index.Configure(ctx); err != nil {
		t.Fatal(err)
	}
	if err := index.Upsert(ctx, []search.Document{doc}); err != nil {
		t.Fatal(err)
	}
	if err := index.Delete(ctx, []int{8, 9}); err != nil {
		t.Fatal(err)
	}
	if err := index.Clear(ctx); err != nil {
		t.Fatal(err)
	}
	want := []struct{ method, path string }{
		{http.MethodPost, "/indexes"},
		{http.MethodPatch, "/indexes/shionlib_games/settings"},
		{http.MethodPost, "/indexes/shionlib_games/documents?primaryKey=id"},
		{http.MethodPost, "/indexes/shionlib_games/documents/delete-batch"},
		{http.MethodDelete, "/indexes/shionlib_games/documents"},
	}
	if len(calls) != len(want) {
		t.Fatalf("calls %+v", calls)
	}
	for i, call := range calls {
		if call.method != want[i].method || call.path != want[i].path || call.auth != "Bearer key" {
			t.Fatalf("call %d: %+v", i, call)
		}
	}
	if calls[0].body != `{"primaryKey":"id","uid":"shionlib_games"}` {
		t.Fatalf("create index body %s", calls[0].body)
	}
	var settings map[string][]string
	if err := json.Unmarshal([]byte(calls[1].body), &settings); err != nil || len(settings["searchableAttributes"]) != 18 || settings["filterableAttributes"][4] != "developers.id" || settings["sortableAttributes"][0] != "release_date" {
		t.Fatalf("settings %s", calls[1].body)
	}
	var docs []map[string]any
	if err := json.Unmarshal([]byte(calls[2].body), &docs); err != nil || len(docs) != 1 {
		t.Fatalf("documents %s", calls[2].body)
	}
	got := docs[0]
	if got["id"] != float64(7) || got["title_jp"] != "サクラノ詩" || got["release_date"] != "2020-04-24T00:00:00Z" || got["nsfw"] != true || got["max_cover_sexual"] != float64(2) {
		t.Fatalf("document scalars %v", got)
	}
	if _, present := got["title_zh"]; present {
		t.Fatalf("empty titles are omitted: %v", got)
	}
	if names := got["developers_names"].([]any); len(names) != 1 || names[0] != "枕" {
		t.Fatalf("developer names %v", got["developers_names"])
	}
	if staffs := got["staffs"].([]any); len(staffs) != 1 || staffs[0].(map[string]any)["role"] != "剧本" {
		t.Fatalf("staffs %v", got["staffs"])
	}
	if calls[3].body != `[8,9]` {
		t.Fatalf("delete body %s", calls[3].body)
	}
}

func TestIndexReportsFailures(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":"invalid_api_key"}`))
	}))
	t.Cleanup(server.Close)
	index := meilisearch.NewIndex(meilisearch.Options{HTTP: server.Client(), Host: server.URL, Index: "games"})
	if err := index.Clear(context.Background()); err == nil {
		t.Fatal("expected an error")
	}
}
