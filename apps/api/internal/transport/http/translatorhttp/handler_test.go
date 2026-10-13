package translatorhttp_test

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator/translatortest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/translatorhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	admin = actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	user  = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	day   = time.Date(2026, 5, 15, 1, 2, 3, 0, time.UTC)
)

func ptr[T any](v T) *T {
	return &v
}

func setup(t *testing.T) (*apitest.Server, *translatortest.MemoryRepository) {
	t.Helper()
	server := apitest.New(t)
	repo := translatortest.NewMemoryRepository()
	translatorhttp.NewHandler(translator.NewService(repo), server.Builder).Register(server.API)
	translatorhttp.NewAdminHandler(translator.NewAdminService(repo, repo, &translatortest.Followers{}, &txtest.Immediate{}), server.Builder).Register(server.API)
	return server, repo
}

func TestListSuggestAndDetailShapes(t *testing.T) {
	server, repo := setup(t)
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组", Aliases: []string{"Green Tea"}, Homepage: ptr("https://tea.example")})
	repo.Seed(translator.Translator{Name: "绿洲汉化组"})
	repo.Credit(1, true, day, tea.ID)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/translator/list?q=green"})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":1,"name":"绿茶汉化组","aliases":["Green Tea"],"works_count":1}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/translator/suggest?q=绿"})
	server.Expect(resp, http.StatusOK, 0)
	want = `[{"id":1,"name":"绿茶汉化组","aliases":["Green Tea"],"works_count":1},{"id":2,"name":"绿洲汉化组","aliases":[],"works_count":0}]`
	if string(resp.Data) != want {
		t.Fatalf("unexpected suggestions\n got %s\nwant %s", resp.Data, want)
	}
	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/translator/suggest"})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != want {
		t.Fatalf("no query suggests the translators with the most works: %s", resp.Data)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/translator/" + strconv.Itoa(tea.ID)})
	server.Expect(resp, http.StatusOK, 0)
	want = `{"id":1,"name":"绿茶汉化组","aliases":["Green Tea"],"homepage":"https://tea.example","works_count":1}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected detail\n got %s\nwant %s", resp.Data, want)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/translator/404"}), http.StatusNotFound, 600101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/translator/list?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}
