package activityhttp_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/activityhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type fixedRepository struct {
	entries []activity.Entry
}

func (f fixedRepository) Create(context.Context, activity.NewActivity) error {
	return nil
}

func (f fixedRepository) List(context.Context, activity.Filter, activity.Page) ([]activity.Entry, int, error) {
	return f.entries, len(f.entries), nil
}

func TestFeedShape(t *testing.T) {
	server := apitest.New(t)
	created := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	status := 3
	repo := fixedRepository{entries: []activity.Entry{
		{ID: 2, Type: activity.TypeFileUploadToS3, User: user.Summary{ID: 1, Name: "u"}, File: &activity.FileRef{ID: 9, FileName: "a.zip", FileSize: 42, FileStatus: &status}, Created: created, Updated: created},
		{ID: 1, Type: activity.TypeDeveloperEdit, User: user.Summary{ID: 1, Name: "u"}, Developer: &activity.DeveloperRef{ID: 4, Name: "Studio"}, Created: created, Updated: created},
	}}
	activityhttp.NewHandler(activity.NewService(repo, gametest.NewCards()), server.Builder).Register(server.API)

	viewer := actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitShowSpoiler}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/activity/list?category=files", As: &viewer})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":2,"type":"FILE_UPLOAD_TO_S3","user":{"id":1,"name":"u","avatar":null,"is_sponsor":false},"game":null,"walkthrough":null,"comment":null,"developer":null,"character":null,"file":{"id":9,"file_name":"a.zip","file_size":42,"file_status":3,"file_check_status":null},"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z"},{"id":1,"type":"DEVELOPER_EDIT","user":{"id":1,"name":"u","avatar":null,"is_sponsor":false},"game":null,"walkthrough":null,"comment":null,"developer":{"id":4,"name":"Studio"},"character":null,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z"}],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":10,"totalPages":1,"currentPage":1,"content_limit":2}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected feed\n got %s\nwant %s", resp.Data, want)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/activity/list?category=unknown"}), http.StatusUnprocessableEntity, 100101)
}
