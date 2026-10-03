package hikarinagi_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/hikarinagi"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type fakeAPI struct {
	t          *testing.T
	mu         sync.Mutex
	tokens     int
	paths      []string
	routes     map[string]string
	statusCode map[string]int
	revoked    int
}

func (f *fakeAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/oidc/token" {
		f.token(w, r)
		return
	}
	f.mu.Lock()
	revoked := f.revoked > 0
	if revoked {
		f.revoked--
	}
	f.mu.Unlock()
	if revoked || r.Header.Get("Authorization") != "Bearer machine-token" {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"success":false,"error":{"code":"AUTH_TOKEN_INVALID","message":"no"}}`))
		return
	}
	f.mu.Lock()
	f.paths = append(f.paths, r.URL.RequestURI())
	f.mu.Unlock()
	path := strings.TrimPrefix(r.URL.Path, "/api/v3")
	if status, ok := f.statusCode[path]; ok {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"success":false,"error":{"code":"X","message":"x"}}`))
		return
	}
	body, ok := f.routes[path]
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"success":false,"error":{"code":"NOT_FOUND","message":"missing"}}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"success":true,"data":` + body + `,"request_id":"r","timestamp":"t"}`))
}

func (f *fakeAPI) token(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		f.t.Errorf("token form: %v", err)
	}
	id, secret, _ := r.BasicAuth()
	if r.Form.Get("client_id") != "" {
		id, secret = r.Form.Get("client_id"), r.Form.Get("client_secret")
	}
	if id != "shionlib" || secret != "s3cret" || r.Form.Get("grant_type") != "client_credentials" || r.Form.Get("resource") != "https://api.hikarinagi.test/open" || r.Form.Get("scope") != "catalog:read catalog:full" {
		f.t.Errorf("unexpected token request %v (client %q)", r.Form, id)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	f.mu.Lock()
	f.tokens++
	f.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "machine-token", "token_type": "Bearer", "expires_in": 3600})
}

func setup(t *testing.T, routes map[string]string) (*hikarinagi.Source, *fakeAPI) {
	t.Helper()
	api := &fakeAPI{t: t, routes: routes, statusCode: map[string]int{}}
	server := httptest.NewServer(api)
	t.Cleanup(server.Close)
	client := hikarinagi.NewClient(hikarinagi.Options{
		BaseURL:      server.URL + "/api/v3/",
		TokenURL:     server.URL + "/oidc/token",
		ClientID:     "shionlib",
		ClientSecret: "s3cret",
		Resource:     "https://api.hikarinagi.test/open",
		Scopes:       []string{"catalog:read", "catalog:full"},
		HTTPClient:   server.Client(),
	})
	return hikarinagi.NewSource(client), api
}

const galgameDetail = `{
  "id": 77, "origin_title": "サクラノ詩", "origin_lang": "ja", "trans_title": "樱之诗", "en_title": null,
  "origin_intro": "あらすじ", "trans_intro": "简介", "en_intro": null,
  "aliases": ["sakuuta"], "adv_type": "ADV", "platforms": ["win"], "nsfw": true,
  "release_date": "2015-10-23T00:00:00.000Z", "release_date_tbd": false,
  "covers": [{"url": "https://cdn.test/c.webp", "width": 800, "height": 1200, "sexual": 0, "violence": 0, "votes": 3, "language": "ja", "kind": "PKGFRONT"}],
  "images": [{"url": "https://cdn.test/s.webp", "width": null, "height": null, "sexual": 1, "violence": 0}],
  "tags": [{"name": "纯爱", "likes": 3}],
  "external_links": [{"name": "official", "label": "官网", "url": "https://example.test"}],
  "vndb_id": 4242, "bangumi_id": 1234,
  "revised_at": null, "updated_at": "2026-09-01T00:00:00.000Z", "rating": {"score": 9}
}`

func TestGameCombinesDetailAndSubresources(t *testing.T) {
	source, api := setup(t, map[string]string{
		"/open/galgames/77":            galgameDetail,
		"/open/galgames/77/staff":      `[{"person": {"id": 1, "name": "すかぢ", "trans_name": null, "image": null}, "role": "SCENARIO"}, {"person": {"id": 2, "name": "謎", "trans_name": null, "image": null}, "role": "NEW_ROLE"}, {"person": {"id": 3, "name": "無", "trans_name": null, "image": null}, "role": null}]`,
		"/open/galgames/77/characters": `[{"character": {"id": 9, "name": "御桜稟", "trans_name": "御樱禀", "image": {"url": "https://cdn.test/rin.webp", "width": 100, "height": 200, "sexual": 0, "violence": 0}}, "actors": [{"id": 4, "name": "有栖川みや美", "trans_name": null, "image": null}, {"id": 5, "name": "某", "trans_name": "某某", "image": null}], "role": "MAIN"}]`,
		"/open/galgames/77/producers":  `[{"producer": {"id": 5, "name": "枕", "trans_name": null, "image": null}, "role": "DEVELOPER", "note": ""}, {"producer": {"id": 6, "name": "发行", "trans_name": null, "image": null}, "role": "PUBLISHER", "note": ""}]`,
		"/open/galgames/77/relations":  `[{"galgame": {"id": 78, "origin_title": "続", "trans_title": null, "nsfw": false, "release_date": null, "covers": []}, "relation": "SEQUEL"}]`,
	})
	snapshot, err := source.Game(context.Background(), "77")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.ExternalID != "77" || snapshot.Title.Origin != "サクラノ詩" || snapshot.Title.OriginLang != "ja" || *snapshot.Title.Translated != "樱之诗" || snapshot.Title.English != nil || snapshot.Intro.Origin != "あらすじ" {
		t.Fatalf("titles %+v %+v", snapshot.Title, snapshot.Intro)
	}
	if snapshot.ReleaseDate == nil || !snapshot.ReleaseDate.Equal(time.Date(2015, 10, 23, 0, 0, 0, 0, time.UTC)) || *snapshot.Type != "ADV" || !snapshot.NSFW || snapshot.Revision != "2026-09-01T00:00:00.000Z" {
		t.Fatalf("scalars %+v", snapshot)
	}
	if *snapshot.External.VNDB != "4242" || *snapshot.External.Bangumi != "1234" {
		t.Fatalf("external ids %+v", snapshot.External)
	}
	if len(snapshot.Covers) != 1 || snapshot.Covers[0].Kind != "PKGFRONT" || snapshot.Covers[0].Language != "ja" || *snapshot.Covers[0].Width != 800 || snapshot.Covers[0].Votes != 3 {
		t.Fatalf("covers %+v", snapshot.Covers)
	}
	if len(snapshot.Images) != 1 || snapshot.Images[0].Sexual != 1 || !slices.Equal(snapshot.Tags, []string{"纯爱"}) || snapshot.Links[0].Label != "官网" {
		t.Fatalf("media %+v %+v %+v", snapshot.Images, snapshot.Tags, snapshot.Links)
	}
	staff := []catalog.Staff{{Name: "すかぢ", Role: "剧本"}, {Name: "謎", Role: "NEW_ROLE"}, {Name: "無", Role: ""}}
	if !slices.Equal(snapshot.Staff, staff) {
		t.Fatalf("staff %+v", snapshot.Staff)
	}
	if len(snapshot.Developers) != 2 || snapshot.Developers[0].ExternalID != "5" || snapshot.Developers[0].Role != "DEVELOPER" || snapshot.Developers[1].Role != "PUBLISHER" {
		t.Fatalf("developers %+v", snapshot.Developers)
	}
	character := snapshot.Characters[0]
	if character.ExternalID != "9" || *character.Translated != "御樱禀" || character.Image.URL != "https://cdn.test/rin.webp" || character.Role != "MAIN" || !slices.Equal(character.Actors, []string{"有栖川みや美", "某某"}) {
		t.Fatalf("character %+v", character)
	}
	if !slices.Equal(snapshot.Relations, []catalog.Relation{{ExternalID: "78", Type: "SEQUEL"}}) {
		t.Fatalf("relations %+v", snapshot.Relations)
	}
	if api.tokens != 1 {
		t.Fatalf("the machine token must be reused, minted %d", api.tokens)
	}
}

func TestDeveloperAndCharacterDetails(t *testing.T) {
	source, _ := setup(t, map[string]string{
		"/open/producers/5":  `{"id": 5, "name": "枕", "aliases": ["Makura"], "intro": "紹介", "trans_intro": "介绍", "en_intro": null, "website": "https://makura.test", "logo": {"url": "https://cdn.test/logo.webp", "width": 10, "height": 10, "sexual": 0, "violence": 0}, "labels": [{"key": "country", "value": "JP"}], "vndb_id": "p100", "bangumi_id": null, "revised_at": "2026-08-01T00:00:00.000Z", "updated_at": "2026-09-01T00:00:00.000Z", "type": "COMPANY"}`,
		"/open/characters/9": `{"id": 9, "name": "御桜稟", "trans_name": "御樱禀", "en_name": "Rin", "aliases": [], "intro": "紹介", "trans_intro": null, "en_intro": null, "image": null, "gender": "女", "blood_type": "A", "height": 158, "weight": null, "bust": null, "waist": null, "hips": null, "cup": null, "age": 17, "birthday_month": 4, "birthday_day": 1, "updated_at": "2026-09-01T00:00:00.000Z"}`,
	})
	developer, err := source.Developer(context.Background(), "5")
	if err != nil {
		t.Fatal(err)
	}
	if developer.Name != "枕" || developer.Intro.Origin != "紹介" || *developer.Intro.Translated != "介绍" || developer.Logo.URL != "https://cdn.test/logo.webp" || *developer.External.VNDB != "p100" || developer.External.Bangumi != nil || developer.Revision != "2026-08-01T00:00:00.000Z" {
		t.Fatalf("developer %+v", developer)
	}
	if !slices.Equal(developer.Extra, []catalog.KeyValue{{Key: "country", Value: "JP"}}) {
		t.Fatalf("labels %+v", developer.Extra)
	}
	character, err := source.Character(context.Background(), "9")
	if err != nil {
		t.Fatal(err)
	}
	if character.Name.Origin != "御桜稟" || *character.Name.English != "Rin" || character.Image != nil || !slices.Equal(character.Gender, []string{"女"}) || *character.BloodType != "A" || *character.Age != 17 || !slices.Equal(character.Birthday, []int{4, 1}) {
		t.Fatalf("character %+v", character)
	}
}

func TestErrorsMapToCatalogSentinels(t *testing.T) {
	source, api := setup(t, map[string]string{})
	if _, err := source.Game(context.Background(), "404"); !errors.Is(err, catalog.ErrNotFound) {
		t.Fatalf("404: %v", err)
	}
	if _, err := source.Game(context.Background(), "not-a-number"); !errors.Is(err, catalog.ErrNotFound) {
		t.Fatalf("invalid id: %v", err)
	}
	api.statusCode["/open/producers/1"] = http.StatusTooManyRequests
	if _, err := source.Developer(context.Background(), "1"); !errors.Is(err, catalog.ErrRateLimited) {
		t.Fatalf("429: %v", err)
	}
	api.statusCode["/open/characters/1"] = http.StatusBadGateway
	_, err := source.Character(context.Background(), "1")
	if err == nil || errors.Is(err, catalog.ErrNotFound) || !strings.Contains(err.Error(), "status 502") {
		t.Fatalf("502: %v", err)
	}
	api.routes["/open/characters/2"] = `null`
	if _, err := source.Character(context.Background(), "2"); !errors.Is(err, catalog.ErrNotFound) {
		t.Fatalf("null data: %v", err)
	}
}

func TestSearchAndChanges(t *testing.T) {
	source, api := setup(t, map[string]string{
		"/open/search":          `{"items": [{"id": 77, "type": "galgame", "title": "サクラノ詩", "subtitle": "樱之诗", "developer": "枕", "cover": {"url": "https://cdn.test/c.webp", "width": 1, "height": 1, "sexual": 0, "violence": 0, "votes": 0}}, {"id": 3, "type": "character", "title": "x", "subtitle": null, "developer": null, "cover": null}], "meta": {"page": 2, "page_size": 5, "total_items": 6, "item_count": 2, "total_pages": 2}}`,
		"/open/catalog/changes": `{"items": [{"id": 11, "resource_type": "GALGAME", "resource_id": 77, "kind": "UPSERT", "merged_to_id": null, "created_at": "t"}, {"id": 12, "resource_type": "LIGHT_NOVEL", "resource_id": 1, "kind": "UPSERT", "merged_to_id": null, "created_at": "t"}, {"id": 13, "resource_type": "PRODUCER", "resource_id": 5, "kind": "MERGE", "merged_to_id": 6, "created_at": "t"}, {"id": 14, "resource_type": "CHARACTER", "resource_id": 9, "kind": "DELETE", "merged_to_id": null, "created_at": "t"}], "latest_id": 20, "has_more": true}`,
	})
	hits, total, err := source.SearchGames(context.Background(), "サクラ", 2, 5)
	if err != nil {
		t.Fatal(err)
	}
	if total != 6 || len(hits) != 1 || hits[0].ExternalID != "77" || *hits[0].Subtitle != "樱之诗" || *hits[0].CoverURL != "https://cdn.test/c.webp" {
		t.Fatalf("hits %+v total %d", hits, total)
	}
	batch, err := source.Changes(context.Background(), "", 50)
	if err != nil {
		t.Fatal(err)
	}
	want := []catalog.Change{
		{Entity: catalog.EntityGame, ExternalID: "77", Kind: catalog.ChangeUpsert},
		{Entity: catalog.EntityDeveloper, ExternalID: "5", Kind: catalog.ChangeMerge, MergedInto: "6"},
		{Entity: catalog.EntityCharacter, ExternalID: "9", Kind: catalog.ChangeDelete},
	}
	if !slices.Equal(batch.Changes, want) || batch.Cursor != "14" || !batch.HasMore {
		t.Fatalf("batch %+v", batch)
	}
	if _, err := source.Changes(context.Background(), "14", 50); err != nil {
		t.Fatal(err)
	}
	wantPaths := []string{
		"/api/v3/open/search?page=2&page_size=5&q=%E3%82%B5%E3%82%AF%E3%83%A9&types=galgame",
		"/api/v3/open/catalog/changes?limit=50&since=0",
		"/api/v3/open/catalog/changes?limit=50&since=14",
	}
	if !slices.Equal(api.paths, wantPaths) {
		t.Fatalf("paths %v", api.paths)
	}
}

func TestARejectedTokenIsReplacedOnce(t *testing.T) {
	source, api := setup(t, map[string]string{"/open/producers/5": `{"id": 5, "name": "枕", "aliases": [], "updated_at": "t"}`})
	if _, err := source.Developer(context.Background(), "5"); err != nil {
		t.Fatal(err)
	}
	api.revoked = 1
	if _, err := source.Developer(context.Background(), "5"); err != nil {
		t.Fatalf("a revoked token must be replaced: %v", err)
	}
	if api.tokens != 2 {
		t.Fatalf("expected a second token, minted %d", api.tokens)
	}
	api.revoked = 2
	if _, err := source.Developer(context.Background(), "5"); err == nil || !strings.Contains(err.Error(), "status 401") {
		t.Fatalf("a second rejection is reported: %v", err)
	}
}
