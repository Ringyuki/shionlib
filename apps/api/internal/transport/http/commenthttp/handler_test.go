package commenthttp_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment/commenttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/commenthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var (
	alice = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	bob   = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
)

const (
	alicePublic = `{"id":1,"name":"alice","avatar":null,"is_sponsor":false}`
	bobPublic   = `{"id":2,"name":"bob","avatar":null,"is_sponsor":false}`
	paragraph   = `<p class=\"[&amp;:not(:first-child)]:mt-6\"><span>hello</span></p>`
	contentJSON = `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hello","format":0}]}]}}`
	stamp       = `"2026-10-03T01:02:03Z"`
)

type env struct {
	server *apitest.Server
	repo   *commenttest.MemoryRepository
	queue  *moderationtest.Queue
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	repo := commenttest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.AddUser(user.Summary{ID: 1, Name: "alice"})
	repo.AddUser(user.Summary{ID: 2, Name: "bob"})
	repo.AddGame(10, false)
	cards := gametest.NewCards(game.Card{ID: 10, TitleJP: "タイトル", Covers: []game.Cover{{URL: "a.webp"}, {URL: "b.webp", Sexual: 1}}})
	queue := &moderationtest.Queue{}
	service := comment.NewService(repo, cards, &moderationtest.Messages{}, queue, &txtest.Immediate{})
	commenthttp.NewHandler(service, server.Builder).Register(server.API)
	return env{server: server, repo: repo, queue: queue}
}

func body(content string, extra string) string {
	return `{"content":` + content + extra + `}`
}

func TestCreateReturnsThePendingComment(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/game/10", As: &alice, Body: body(contentJSON, "")})
	e.server.Expect(resp, http.StatusCreated, 0)
	want := `{"id":1,"content":` + contentJSON + `,"html":"` + paragraph + `","parent_id":null,"parent":null,"root_id":1,"creator":` + alicePublic + `,"status":2,"created":` + stamp + `,"updated":` + stamp + `,"like_count":0}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body\n got %s\nwant %s", resp.Data, want)
	}
	if jobs := e.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ScreenComment{CommentID: 1}) {
		t.Fatalf("expected a screening job, got %+v", jobs)
	}

	reply := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/game/10", As: &bob, Body: body(contentJSON, `,"parent_id":1`)})
	e.server.Expect(reply, http.StatusCreated, 0)
	if !strings.Contains(string(reply.Data), `"parent_id":1,"parent":{"id":1,"html":"`+paragraph+`","creator":`+alicePublic+`},"root_id":1,"creator":`+bobPublic) {
		t.Fatalf("unexpected reply %s", reply.Data)
	}
}

func TestCreateValidation(t *testing.T) {
	e := setup(t)
	long := `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"` + strings.Repeat("a", 10001) + `"}]}]}}`
	cases := []struct {
		name    string
		as      *actor.Actor
		path    string
		body    string
		status  int
		code    int
		message string
	}{
		{"unauthenticated", nil, "/comment/game/10", body(contentJSON, ""), http.StatusUnauthorized, 200101, ""},
		{"missing content", &alice, "/comment/game/10", `{}`, http.StatusUnprocessableEntity, 100101, ""},
		{"content is not an object", &alice, "/comment/game/10", body(`"text"`, ""), http.StatusUnprocessableEntity, 100101, "content 必须是对象"},
		{"unsupported node", &alice, "/comment/game/10", body(`{"root":{"type":"root","children":[{"type":"image","src":"x"}]}}`, ""), http.StatusUnprocessableEntity, 100101, `content contains an unsupported node type \"image\"`},
		{"too long", &alice, "/comment/game/10", body(long, ""), http.StatusUnprocessableEntity, 100101, "10000"},
		{"unknown property", &alice, "/comment/game/10", body(contentJSON, `,"extra":1`), http.StatusUnprocessableEntity, 100101, ""},
		{"non integer game", &alice, "/comment/game/abc", body(contentJSON, ""), http.StatusUnprocessableEntity, 100101, ""},
		{"missing parent", &alice, "/comment/game/10", body(contentJSON, `,"parent_id":99`), http.StatusNotFound, 470101, ""},
		{"missing game", &alice, "/comment/game/99", body(contentJSON, ""), http.StatusNotFound, 400101, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: c.path, As: c.as, Body: c.body})
			e.server.Expect(resp, c.status, c.code)
			if c.message != "" && !strings.Contains(string(resp.Body), c.message) {
				t.Fatalf("expected %q in %s", c.message, resp.Body)
			}
		})
	}
}

func TestEditRawDeleteAndLike(t *testing.T) {
	e := setup(t)
	root := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/game/10", As: &alice, Body: body(contentJSON, "")})
	e.server.Expect(root, http.StatusCreated, 0)

	edited := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/comment/1", As: &alice, Body: body(contentJSON, "")})
	e.server.Expect(edited, http.StatusOK, 0)
	want := `{"id":1,"content":` + contentJSON + `,"html":"` + paragraph + `","parent_id":null,"root_id":1,"creator":` + alicePublic + `,"edited":true,"status":2,"created":` + stamp + `,"updated":` + stamp + `}`
	if string(edited.Data) != want {
		t.Fatalf("unexpected edit\n got %s\nwant %s", edited.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/comment/1", As: &bob, Body: body(contentJSON, "")}), http.StatusForbidden, 470102)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/comment/0", As: &alice, Body: body(contentJSON, "")}), http.StatusNotFound, 470101)

	raw := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/1/raw", As: &alice})
	e.server.Expect(raw, http.StatusOK, 0)
	if string(raw.Data) != `{"id":1,"content":`+contentJSON+`,"creator_id":1}` {
		t.Fatalf("unexpected raw %s", raw.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/1/raw", As: &bob}), http.StatusForbidden, 470102)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/1/raw"}), http.StatusUnauthorized, 200101)

	like := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/1/like", As: &bob})
	e.server.Expect(like, http.StatusCreated, 0)
	if like.HasData {
		t.Fatalf("void endpoints omit data: %s", like.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/9/like", As: &bob}), http.StatusNotFound, 470101)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/comment/1", As: &bob}), http.StatusForbidden, 470102)
	deleted := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/comment/1", As: &alice})
	e.server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/comment/1", As: &alice}), http.StatusNotFound, 470101)
}

func TestListByGameShape(t *testing.T) {
	e := setup(t)
	html := "<p>root</p>"
	root := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, HTML: &html, Status: comment.StatusVisible})
	_ = e.repo.SetRoot(t.Context(), root.ID, root.ID)
	reply := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 2, HTML: &html, ParentID: &root.ID, RootID: &root.ID, ReplyCount: 0, Status: comment.StatusPending})
	if _, err := e.repo.AddLike(t.Context(), root.ID, 2); err != nil {
		t.Fatal(err)
	}

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?page=1&pageSize=5", As: &bob})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":1,"html":"<p>root</p>","parent_id":null,"root_id":1,"reply_count":0,"parent":{"id":null},"is_liked":true,"like_count":1,"creator":` + alicePublic + `,"edited":false,"status":1,"created":` + stamp + `,"updated":` + stamp + `},` +
		`{"id":` + strconv.Itoa(reply.ID) + `,"html":"<p>root</p>","parent_id":1,"root_id":1,"reply_count":0,"parent":{"id":1,"html":"<p>root</p>","creator":` + alicePublic + `},"is_liked":false,"like_count":0,"creator":` + bobPublic + `,"edited":false,"status":2,"created":` + stamp + `,"updated":` + stamp + `}` +
		`],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":5,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", resp.Data, want)
	}
	guest := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10"})
	e.server.Expect(guest, http.StatusOK, 0)
	if !strings.Contains(string(guest.Data), `"totalItems":1`) || !strings.Contains(string(guest.Data), `"is_liked":false`) {
		t.Fatalf("guests only see visible comments: %s", guest.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}

func TestListByUserShape(t *testing.T) {
	e := setup(t)
	html := "<p>mine</p>"
	e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, HTML: &html, Status: comment.StatusVisible})
	e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, HTML: &html, Status: comment.StatusPending})

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/comments", As: &alice})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":1,"html":"<p>mine</p>","parent_id":null,"root_id":null,"reply_count":0,"parent":null,"is_liked":false,"like_count":0,` +
		`"game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[{"language":"","type":"","url":"a.webp","dims":[],"sexual":0,"violence":0}],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]},` +
		`"creator":` + alicePublic + `,"created":` + stamp + `,"updated":` + stamp + `}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1,"is_current_user":true}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected user comments\n got %s\nwant %s", resp.Data, want)
	}
	other := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/comments", As: &bob})
	if !strings.Contains(string(other.Data), `"is_current_user":false`) || !strings.Contains(string(other.Data), `"url":"b.webp"`) {
		t.Fatalf("rated viewers see every cover and are not the owner: %s", other.Data)
	}
}
