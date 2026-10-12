package adminhttp_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin/admintest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adminhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func newStatsServer(t *testing.T) *apitest.Server {
	t.Helper()
	server := apitest.New(t)
	store := admintest.NewStatsStore(
		admin.Overview{TotalGames: 1, TotalUsers: 2, TotalDownloads: 3, TotalViews: 4, TotalCharacters: 5, TotalDevelopers: 6, TotalComments: 7, TotalResources: 10, NewGamesToday: 8, NewUsersToday: 9, NewResourcesToday: 11, NewCommentsToday: 12, DownloadsToday: 13, ViewsToday: 14},
		admin.DailyCounts{Games: map[string]int{"2026-10-02": 2}, Users: map[string]int{"2026-10-03": 1}, Downloads: map[string]int{"2026-10-03": 5}, Views: map[string]int{"2026-10-02": 6}},
	)
	store.Seed(
		admin.Pending{Reports: 2, MalwareCases: 1, StalledFiles: 1, Comments: 9, Walkthroughs: 3},
		admin.FileCounts{Uploading: admin.Tally{Files: 3, Bytes: 1200}, AwaitingCheck: 1, AwaitingStore: 2, Stored: admin.Tally{Files: 7395, Bytes: 1 << 44}},
	)
	service := admin.NewStatsService(admin.StatsDeps{
		Store:    store,
		Cache:    admintest.NewCache(),
		Spool:    admintest.Spool{Total: 4000, Free: 2500},
		AI:       admintest.AIGateway(2),
		Settings: settingtest.Source{},
		Now:      func() time.Time { return apitest.Now },
	})
	adminhttp.NewStatsHandler(service, server.Builder).Register(server.API)
	return server
}

func TestAdminStatsShapes(t *testing.T) {
	server := newStatsServer(t)
	staff := actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	member := actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/overview", As: &member}), http.StatusForbidden, 403)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/overview", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"totalGames":1,"totalUsers":2,"totalDownloads":3,"totalViews":4,"totalCharacters":5,"totalDevelopers":6,"totalComments":7,"totalResources":10,"newGamesToday":8,"newUsersToday":9,"newResourcesToday":11,"newCommentsToday":12,"downloadsToday":13,"viewsToday":14}`
	if string(resp.Data) != want {
		t.Fatalf("overview\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/trends?days=2&startDate=2026-01-01", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want = `[{"date":"2026-10-02","games":2,"users":0,"downloads":0,"views":6},{"date":"2026-10-03","games":0,"users":1,"downloads":5,"views":0}]`
	if string(resp.Data) != want {
		t.Fatalf("trends\n got %s\nwant %s", resp.Data, want)
	}
	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/trends", As: &staff})
	if server.Expect(resp, http.StatusOK, 0); strings.Count(string(resp.Data), `"date"`) != 30 {
		t.Fatalf("thirty days by default: %s", resp.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/trends?days=91", As: &staff}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/trends?days=0", As: &staff}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminPendingAndStorageShapes(t *testing.T) {
	server := newStatsServer(t)
	staff := actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	member := actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	for _, path := range []string{"/admin/pending", "/admin/stats/storage"} {
		server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: path}), http.StatusUnauthorized, 200101)
		server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &member}), http.StatusForbidden, 403)
	}

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/pending", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"reports":2,"malware_cases":1,"stalled_files":1,"comments":9,"walkthroughs":3,"ai_alerts":2}`
	if string(resp.Data) != want {
		t.Fatalf("pending\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/storage", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want = `{"spool_capacity":4000,"spool_available":2500,"spool_reserve":21474836480,"uploading":{"files":3,"bytes":1200},"awaiting_check":1,"awaiting_store":2,"stored":{"files":7395,"bytes":17592186044416}}`
	if string(resp.Data) != want {
		t.Fatalf("storage\n got %s\nwant %s", resp.Data, want)
	}
}
