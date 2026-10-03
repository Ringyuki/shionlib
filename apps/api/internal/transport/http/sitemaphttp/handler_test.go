package sitemaphttp_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sitemaphttp"
)

type store struct{}

func (store) Count(_ context.Context, section sitemap.Section) (int, error) {
	if section == sitemap.SectionGame {
		return 1, nil
	}
	return 0, nil
}

func (store) Entries(_ context.Context, section sitemap.Section, offset, _ int) ([]sitemap.Entry, error) {
	if section != sitemap.SectionGame || offset > 0 {
		return []sitemap.Entry{}, nil
	}
	return []sitemap.Entry{{ID: 9, Updated: apitest.Now}}, nil
}

func setup(t *testing.T) (*apitest.Server, *gametest.Cache) {
	t.Helper()
	server := apitest.New(t)
	cache := gametest.NewCache()
	service := sitemap.NewService(store{}, cache, func() time.Time { return apitest.Now })
	sitemaphttp.NewHandler(service, "https://shionlib.com/").Register(server.API)
	return server, cache
}

func get(server *apitest.Server, path, remote string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = remote
	req.Host = "api.internal:5000"
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	recorder := httptest.NewRecorder()
	server.API.Handler().ServeHTTP(recorder, req)
	return recorder
}

func TestIndexUsesTrustedForwardedHost(t *testing.T) {
	server, cache := setup(t)
	resp := get(server, "/sitemap.xml", "127.0.0.1:1234", map[string]string{"X-Forwarded-Host": "b.example.com, proxy.internal", "X-Forwarded-Proto": "https"})
	if resp.Code != http.StatusOK || resp.Header().Get("Content-Type") != "application/xml; charset=utf-8" || resp.Header().Get("Cache-Control") != "public, max-age=3600" {
		t.Fatalf("unexpected response %d %v", resp.Code, resp.Header())
	}
	if !strings.Contains(resp.Body.String(), "<loc>https://b.example.com/sitemap-game-1.xml</loc>") || strings.Contains(resp.Body.String(), "sitemap-developer") {
		t.Fatalf("unexpected index %s", resp.Body.String())
	}
	if !cache.Has("sitemap:index:https://b.example.com") {
		t.Fatal("index must be cached per site")
	}

	untrusted := get(server, "/sitemap.xml", "203.0.113.9:1234", map[string]string{"X-Forwarded-Host": "evil.example"})
	if !strings.Contains(untrusted.Body.String(), "<loc>http://api.internal:5000/sitemap-game-1.xml</loc>") {
		t.Fatalf("untrusted clients cannot choose the host: %s", untrusted.Body.String())
	}
	injected := get(server, "/sitemap.xml", "127.0.0.1:1234", map[string]string{"X-Forwarded-Host": `evil"/><x`})
	if !strings.Contains(injected.Body.String(), "<loc>https://shionlib.com/sitemap-game-1.xml</loc>") {
		t.Fatalf("malformed hosts fall back to the configured site: %s", injected.Body.String())
	}
}

func TestSectionAndStylesheet(t *testing.T) {
	server, _ := setup(t)
	resp := get(server, "/sitemap-game-1.xml", "127.0.0.1:1234", map[string]string{"X-Forwarded-Host": "c.example.com", "X-Forwarded-Proto": "https"})
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `<url><loc>https://c.example.com/zh/game/9</loc>`) {
		t.Fatalf("unexpected section %d %s", resp.Code, resp.Body.String())
	}
	invalid := get(server, "/sitemap-user-1.xml", "127.0.0.1:1234", nil)
	if invalid.Code != http.StatusOK || invalid.Body.String() != sitemap.EmptyURLSet {
		t.Fatalf("unknown sections: %d %s", invalid.Code, invalid.Body.String())
	}
	if bad := get(server, "/sitemap-game-abc.xml", "127.0.0.1:1234", nil); bad.Code != http.StatusUnprocessableEntity {
		t.Fatalf("non-numeric page: %d %s", bad.Code, bad.Body.String())
	}

	xsl := get(server, "/sitemap.xsl", "127.0.0.1:1234", nil)
	want, err := os.ReadFile("sitemap.xsl")
	if err != nil {
		t.Fatal(err)
	}
	if xsl.Code != http.StatusOK || xsl.Header().Get("Content-Type") != "text/xsl; charset=utf-8" || xsl.Header().Get("Cache-Control") != "public, max-age=86400" || !bytes.Equal(xsl.Body.Bytes(), want) {
		t.Fatalf("unexpected stylesheet %d %v", xsl.Code, xsl.Header())
	}
}
