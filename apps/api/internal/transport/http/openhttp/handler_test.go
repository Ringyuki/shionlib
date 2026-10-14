package openhttp_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/open"
	"github.com/Ringyuki/shionlib/apps/api/internal/open/opentest"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/openhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type gate struct{}

func (gate) AuthenticateKey(_ context.Context, secret, _ string) (httpapi.KeyHolder, error) {
	if secret != "shl_good" {
		return httpapi.KeyHolder{}, auth.ErrUnauthorized.Wrap(errors.New("no such key"))
	}
	return httpapi.KeyHolder{KeyID: 1, UserID: 5}, nil
}

func (gate) RecordKeyUse(context.Context, httpapi.KeyHolder, bool) error {
	return nil
}

func ptr[T any](v T) *T {
	return &v
}

func setup(t *testing.T) *apitest.Server {
	t.Helper()
	server := apitest.New(t, func(options *httpapi.Options) { options.Keys = gate{} })
	games := &opentest.Games{List: []open.Game{{ID: 1947, HID: ptr(2303), BID: ptr("7868"), VID: ptr("v1141"), TitleJP: "俺たちに翼はない", TitleZH: "我们没有翅膀"}}}
	group := download.TranslationGroup
	portable := download.FormPortable
	resources := &opentest.Resources{ByGame: map[int][]download.GameResource{1947: {{
		Resource: download.Resource{
			ID: 3443, GameID: 1947, Platforms: []string{"win"}, Languages: []string{"zh"}, Downloads: 237,
			PublishedAt: ptr(apitest.Now), Updated: apitest.Now,
			Note: &download.Note{Content: []byte(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"含全CG存档","marks":[{"type":"bold"}]}]}]}`), Text: "含全CG存档"},
			Info: download.Info{Translation: &group, Form: &portable, Translators: []translator.Ref{{ID: 447, Name: "新米日文游戏中文化技术交流小组"}}},
		},
		Creator: user.Summary{ID: 1, Name: "ringyuki"},
		Files:   []download.GameFile{{File: download.File{ID: 3434, Name: "a.7z", Size: 2468559932, HashAlgorithm: upload.HashBLAKE3, Hash: "11985d44"}}},
	}}}}
	openhttp.NewHandler(open.NewService(games, resources), server.Builder, "https://shionlib.com/", "test").Register(server.API)
	return server
}

func lookup(server *apitest.Server, query, key string) apitest.Response {
	return server.Do(apitest.Request{Method: http.MethodGet, Path: "/open/v1/games" + query, Header: map[string]string{"Authorization": "Bearer " + key}})
}

func TestGamesAreFoundWithTheirResourcesByAnyID(t *testing.T) {
	server := setup(t)
	server.Expect(lookup(server, "?vid=v1141", "shl_bad"), http.StatusUnauthorized, 200101)
	resp := lookup(server, "?vid=1141,v404", "shl_good")
	server.Expect(resp, http.StatusOK, 0)
	body := string(resp.Data)
	for _, part := range []string{
		`"id":1947,"hid":2303,"bid":"7868","vid":"v1141"`,
		`"url":"https://shionlib.com/game/1947"`,
		`"url":"https://shionlib.com/resource/3443"`,
		`"translation":"group","translators":[{"id":447,"name":"新米日文游戏中文化技术交流小组"}]`,
		`"creator":{"id":1,"name":"ringyuki"}`,
		`"note":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"含全CG存档","marks":[{"type":"bold"}]}]}]}`,
		`"files":[{"id":3434,"file_name":"a.7z","file_size":2468559932,"hash_algorithm":"blake3","file_hash":"11985d44","sha256":null}]`,
		`"missing":["v404"]`,
	} {
		if !strings.Contains(body, part) {
			t.Fatalf("missing %s in %s", part, body)
		}
	}
	if strings.Contains(body, "s3_file_key") || strings.Contains(body, "file_status") {
		t.Fatalf("nothing internal is shown: %s", body)
	}
}

func TestOneKindOfIDIsAskedForAtATime(t *testing.T) {
	server := setup(t)
	server.Expect(lookup(server, "", "shl_good"), http.StatusUnprocessableEntity, 690101)
	server.Expect(lookup(server, "?id=1&bid=2", "shl_good"), http.StatusUnprocessableEntity, 690101)
	server.Expect(lookup(server, "?bid=abc", "shl_good"), http.StatusUnprocessableEntity, 690103)
}

func TestTheOpenAPIDocumentHoldsOnlyTheOpenRoutes(t *testing.T) {
	server := setup(t)
	rec := httptest.NewRecorder()
	server.API.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/open/v1/openapi.json", nil))
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("status %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"/open/v1/games"`) || !strings.Contains(body, `"OpenLookupDTO"`) || !strings.Contains(body, `"RichTextDocument":{`) || !strings.Contains(body, `"RichTextMark":{`) || !strings.Contains(body, `"url":"https://shionlib.com/api"`) || strings.Contains(body, "accessCookie") {
		t.Fatalf("unexpected document %s", body[:min(len(body), 500)])
	}
}
