package adminhttp_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin/admintest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adminhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func newStatsServer(t *testing.T) *apitest.Server {
	t.Helper()
	server := apitest.New(t)
	store := admintest.NewStatsStore(
		admin.Overview{TotalGames: 1, TotalUsers: 2, TotalDownloads: 3, TotalViews: 4, TotalCharacters: 5, TotalDevelopers: 6, TotalComments: 7, NewGamesToday: 8, NewUsersToday: 9},
		admin.DailyCounts{Games: map[string]int{"2026-10-02": 2}, Users: map[string]int{"2026-10-03": 1}},
	)
	service := admin.NewStatsService(store, admintest.NewCache(), func() time.Time { return apitest.Now })
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
	want := `{"totalGames":1,"totalUsers":2,"totalDownloads":3,"totalViews":4,"totalCharacters":5,"totalDevelopers":6,"totalComments":7,"newGamesToday":8,"newUsersToday":9}`
	if string(resp.Data) != want {
		t.Fatalf("overview\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/stats/trends?days=2&startDate=2026-01-01", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want = `[{"date":"2026-10-02","games":2,"users":0,"downloads":0,"views":0},{"date":"2026-10-03","games":0,"users":1,"downloads":0,"views":0}]`
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
