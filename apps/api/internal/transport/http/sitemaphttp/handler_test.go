package sitemaphttp_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sitemaphttp"
)

var modified = time.Date(2026, 10, 2, 3, 4, 5, 0, time.UTC)

type store struct{}

func (store) Count(_ context.Context, section sitemap.Section) (int, error) {
	if section == sitemap.SectionWalkthrough {
		return 1, nil
	}
	return 0, nil
}

func (store) Entries(_ context.Context, section sitemap.Section, offset, _ int) ([]sitemap.Entry, error) {
	if section != sitemap.SectionWalkthrough || offset > 0 {
		return []sitemap.Entry{}, nil
	}
	return []sitemap.Entry{{ID: 4, GameID: 9, Modified: &modified}, {ID: 5, GameID: 9}}, nil
}

func setup(t *testing.T) *apitest.Server {
	t.Helper()
	server := apitest.New(t)
	sitemaphttp.NewHandler(sitemap.NewService(store{}, gametest.NewCache()), server.Builder).Register(server.API)
	return server
}

func TestSectionsAndEntries(t *testing.T) {
	server := setup(t)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/sitemap/sections"})
	server.Expect(resp, http.StatusOK, 0)
	want := `[{"section":"game","pages":0},{"section":"resource","pages":0},{"section":"walkthrough","pages":1},{"section":"developer","pages":0},{"section":"character","pages":0},{"section":"translator","pages":0}]`
	if string(resp.Data) != want {
		t.Fatalf("unexpected sections\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/sitemap/walkthrough/1"})
	server.Expect(resp, http.StatusOK, 0)
	want = `[{"id":4,"game_id":9,"modified":"2026-10-02T03:04:05.000Z"},{"id":5,"game_id":9}]`
	if string(resp.Data) != want {
		t.Fatalf("unexpected entries\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/sitemap/walkthrough/2"})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[]` {
		t.Fatalf("a page beyond the entries is empty: %s", resp.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/sitemap/user/1"}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/sitemap/game/0"}), http.StatusUnprocessableEntity, 100101)
}
