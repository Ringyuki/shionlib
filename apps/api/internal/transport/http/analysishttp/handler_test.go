package analysishttp_test

import (
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis/analysistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/analysishttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func setup(t *testing.T, traffic *analysistest.Traffic) *apitest.Server {
	t.Helper()
	server := apitest.New(t)
	stats := &analysistest.Stats{
		Total: analysis.Totals{Games: 10, Files: 20, Resources: 15, StorageBytes: 1 << 40},
		Refs:  map[int]analysis.GameRef{1: {Titles: analysis.GameTitles{JP: "ゲーム", ZH: "游戏", EN: "Game"}}, 2: {Rated: true}},
	}
	service := analysis.NewService(stats, analysistest.Served{Bytes: 4096}, traffic, analysistest.NewCache(), slog.New(slog.NewTextHandler(io.Discard, nil)), func() time.Time { return apitest.Now })
	analysishttp.NewHandler(service, server.Builder).Register(server.API)
	return server
}

func TestOverviewIsPublic(t *testing.T) {
	server := setup(t, &analysistest.Traffic{})
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/analysis/data/overview"})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"games":10,"files":20,"resources":15,"storage":1099511627776,"bytes_gotten":4096}` {
		t.Fatalf("unexpected overview %s", resp.Data)
	}
}

func TestTrafficDetailShape(t *testing.T) {
	traffic := &analysistest.Traffic{Raw: analysis.RawTraffic{
		Current:  analysis.Counter{DownloadCount: 4, TotalBytes: 10},
		TopFiles: []analysis.FileTraffic{{FileID: "5", FileName: "a.zip", Counter: analysis.Counter{DownloadCount: 1, TotalBytes: 2}}},
		TopGames: []analysis.RawGameTraffic{{GameID: 1, Counter: analysis.Counter{DownloadCount: 1, TotalBytes: 3}}, {GameID: 2}, {GameID: 9}},
	}}
	server := setup(t, traffic)
	permissive := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitJustShow}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/analysis/data/traffic-detail", As: &permissive})
	server.Expect(resp, http.StatusOK, 0)
	body := string(resp.Data)
	for _, fragment := range []string{
		`"totalDownloads":4,"totalBytes":10,"averageSize":3,"prevTotalDownloads":0,"prevTotalBytes":0,"prevAverageSize":0`,
		`"hourly":[{"hour":"2026-10-02T02:00:00Z","totalBytes":0,"downloadCount":0}`,
		`{"hour":"2026-10-03T01:00:00Z","totalBytes":0,"downloadCount":0}]`,
		`"topFiles":[{"fileId":"5","fileName":"a.zip","totalBytes":2,"downloadCount":1}]`,
		`"countries":[]`,
		`{"gameId":1,"gameName":{"title_jp":"ゲーム","title_zh":"游戏","title_en":"Game"},"totalBytes":3,"downloadCount":1}`,
		`{"gameId":9,"gameName":{"title_jp":null,"title_zh":null,"title_en":null},"totalBytes":0,"downloadCount":0}`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("missing %s in %s", fragment, body)
		}
	}
	guest := server.Do(apitest.Request{Method: http.MethodGet, Path: "/analysis/data/traffic-detail"})
	server.Expect(guest, http.StatusOK, 0)
	if strings.Contains(string(guest.Data), `"gameId":2`) {
		t.Fatalf("guests must not see rated games: %s", guest.Data)
	}
}

func TestTrafficDetailUnavailable(t *testing.T) {
	server := setup(t, &analysistest.Traffic{Fail: analysis.ErrNotConfigured})
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/analysis/data/traffic-detail"})
	server.Expect(resp, http.StatusBadGateway, 590101)
	if !strings.Contains(resp.Message, "CLOUDFLARE_ACCOUNT_ID") {
		t.Fatalf("missing config is explained: %s", resp.Message)
	}
}
