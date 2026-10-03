package characterhttp_test

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/character/charactertest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/characterhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	admin = actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	user  = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
)

func ptr[T any](v T) *T {
	return &v
}

func setup(t *testing.T) (*apitest.Server, *charactertest.MemoryRepository) {
	t.Helper()
	server := apitest.New(t)
	repo := charactertest.NewMemoryRepository()
	characterhttp.NewHandler(character.NewService(repo, &txtest.Immediate{}), server.Builder).Register(server.API)
	return server, repo
}

func TestListAndDetailShapes(t *testing.T) {
	server, repo := setup(t)
	sora := repo.Seed(character.Character{
		BID: ptr("12"), HID: ptr(77), NameJP: "穹", NameEN: ptr("Sora"), Aliases: []string{"ソラ"}, IntroJP: "intro",
		Image: ptr("c.webp"), BloodType: ptr("ab"), Height: ptr(150), Cup: ptr("A"), Birthday: []int{3, 14}, Gender: []string{"f"},
	})
	repo.Seed(character.Character{NameJP: "other"})

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/character/list?q=sora&pageSize=5"})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"b_id":"12","v_id":null,"id":1,"name_jp":"穹","name_zh":null,"name_en":"Sora","aliases":["ソラ"],"intro_jp":"intro","intro_zh":"","intro_en":"","image":"c.webp","blood_type":"ab","height":150,"weight":null,"bust":null,"waist":null,"hips":null,"cup":"A","age":null,"birthday":[3,14],"gender":["f"]}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":5,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/character/" + strconv.Itoa(sora.ID)})
	server.Expect(resp, http.StatusOK, 0)
	want = `{"id":1,"h_id":77,"name_jp":"穹","name_zh":"","name_en":"Sora","aliases":["ソラ"],"intro_jp":"intro","intro_zh":"","intro_en":"","image":"c.webp","blood_type":"ab","height":150,"weight":null,"bust":null,"waist":null,"hips":null,"cup":"A","age":null,"birthday":[3,14],"gender":["f"]}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected detail\n got %s\nwant %s", resp.Data, want)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/character/404"}), http.StatusNotFound, 420101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/character/list?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}

func TestDeleteRequiresAdmin(t *testing.T) {
	server, repo := setup(t)
	linked := repo.Seed(character.Character{NameJP: "linked"})
	repo.Link(linked.ID)
	free := repo.Seed(character.Character{NameJP: "free", Created: time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC), Updated: time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)})
	path := "/character/" + strconv.Itoa(free.ID)

	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &user}), http.StatusForbidden, 403)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/character/" + strconv.Itoa(linked.ID), As: &admin}), http.StatusConflict, 420104)
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/character/404", As: &admin}), http.StatusNotFound, 420101)

	resp := server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"id":2,"b_id":null,"v_id":null,"h_id":null,"image":null,"name_jp":"free","name_zh":null,"name_en":null,"aliases":[],"intro_jp":"","intro_zh":"","intro_en":"","blood_type":null,"height":null,"weight":null,"bust":null,"waist":null,"hips":null,"cup":null,"age":null,"birthday":[],"gender":[],"created":"2025-01-02T03:04:05Z","updated":"2025-01-02T03:04:05Z"}`
	if string(resp.Data) != want {
		t.Fatalf("delete returns the removed row\n got %s\nwant %s", resp.Data, want)
	}
}
