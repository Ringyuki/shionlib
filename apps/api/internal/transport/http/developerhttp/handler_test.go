package developerhttp_test

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer/developertest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/developerhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	admin = actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	user  = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
)

func ptr[T any](v T) *T {
	return &v
}

func setup(t *testing.T) (*apitest.Server, *developertest.MemoryRepository) {
	t.Helper()
	server := apitest.New(t)
	repo := developertest.NewMemoryRepository()
	developerhttp.NewHandler(developer.NewService(repo, &txtest.Immediate{}), server.Builder).Register(server.API)
	return server, repo
}

func TestListAndDetailShapes(t *testing.T) {
	server, repo := setup(t)
	yuzu := repo.Seed(developer.Developer{
		Name: "Yuzusoft", Aliases: []string{"柚子社"}, Logo: ptr("logo.webp"), IntroZH: "简介", Website: ptr("https://yuzu-soft.com"), HID: ptr(5),
		ExtraInfo: []developer.ExtraInfo{{Key: "国家/地区", Value: "日本"}},
	})
	repo.Link(yuzu.ID, false)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/developer/list?q=柚子"})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":1,"name":"Yuzusoft","aliases":["柚子社"],"logo":"logo.webp","works_count":1}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/developer/" + strconv.Itoa(yuzu.ID)})
	server.Expect(resp, http.StatusOK, 0)
	want = `{"id":1,"h_id":5,"name":"Yuzusoft","aliases":["柚子社"],"logo":"logo.webp","intro_jp":"","intro_zh":"简介","intro_en":"","website":"https://yuzu-soft.com","extra_info":[{"key":"国家/地区","value":"日本"}]}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected detail\n got %s\nwant %s", resp.Data, want)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/developer/404"}), http.StatusNotFound, 410101)
}

func TestDeleteRequiresAdminAndHonorsBlockers(t *testing.T) {
	server, repo := setup(t)
	linked := repo.Seed(developer.Developer{Name: "linked"})
	repo.Link(linked.ID, false)
	parent := repo.Seed(developer.Developer{Name: "parent"})
	repo.Seed(developer.Developer{Name: "child", ParentID: &parent.ID})
	free := repo.Seed(developer.Developer{Name: "free"})
	path := func(id int) string { return "/developer/" + strconv.Itoa(id) }

	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path(free.ID)}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path(free.ID), As: &user}), http.StatusForbidden, 403)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path(404), As: &admin}), http.StatusNotFound, 410101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path(linked.ID), As: &admin}), http.StatusConflict, 410104)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path(parent.ID), As: &admin}), http.StatusConflict, 410105)
	resp := server.Do(apitest.Request{Method: http.MethodDelete, Path: path(free.ID), As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("delete omits data: %s", resp.Body)
	}
}
