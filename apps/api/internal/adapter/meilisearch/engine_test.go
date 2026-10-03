package meilisearch_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/meilisearch"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

func TestSanitize(t *testing.T) {
	cases := map[string]string{
		"--hello-":   "hello",
		"foo -bar":   "foo bar",
		"a - b":      "a - b",
		"x  y   z":   "x y z",
		"  学园  -恋爱 ": "学园 恋爱",
		"well-known": "well-known",
		"-":          "",
		" --double":  "-double",
	}
	for in, want := range cases {
		if got := meilisearch.Sanitize(in); got != want {
			t.Errorf("Sanitize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSearchSendsFiltersAndMapsHighlights(t *testing.T) {
	var received map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/indexes/shionlib_games/search" || r.Header.Get("Authorization") != "Bearer key" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&received)
		_, _ = w.Write([]byte(`{"hits":[{"id":3,"title_jp":"x","_formatted":{"title_jp":"<span class=\"search-highlight\">x</span>","aliases":["a"]}},{"id":1}],"totalHits":12,"totalPages":2}`))
	}))
	t.Cleanup(server.Close)
	engine := meilisearch.NewEngine(meilisearch.Options{HTTP: server.Client(), Host: server.URL + "/", APIKey: "key", Index: "shionlib_games"})

	result, err := engine.Search(context.Background(), search.Criteria{Q: "-x", Tag: `say "hi"`, ExcludeRated: true, Page: search.Page{Number: 2, Size: 10}})
	if err != nil {
		t.Fatal(err)
	}
	if received["q"] != "x" || received["page"] != float64(2) || received["hitsPerPage"] != float64(10) {
		t.Fatalf("unexpected request %+v", received)
	}
	filters := []string{}
	for _, f := range received["filter"].([]any) {
		filters = append(filters, f.(string))
	}
	if !slices.Equal(filters, []string{"nsfw = false", "max_cover_sexual = 0", `tags = "say \"hi\""`}) {
		t.Fatalf("unexpected filters %v", filters)
	}
	if len(result.Hits) != 2 || result.Hits[0].GameID != 3 || *result.Hits[0].Highlight.TitleJP != `<span class="search-highlight">x</span>` || result.Hits[1].Highlight != nil || result.Total != 12 || result.TotalPages != 2 {
		t.Fatalf("unexpected result %+v", result)
	}

	missing := meilisearch.NewEngine(meilisearch.Options{HTTP: server.Client(), Host: server.URL, APIKey: "key", Index: "other"})
	if _, err := missing.Search(context.Background(), search.Criteria{Q: "x", Page: search.Page{Number: 1, Size: 10}}); err == nil {
		t.Fatal("a missing index must fail")
	}
}
