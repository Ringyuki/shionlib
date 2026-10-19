package commenthttp_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment/commenttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
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
	paragraph   = `hello`
	contentJSON = `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}`
	stamp       = `"2026-10-03T01:02:03.000Z"`
)

type resources map[int]comment.ResourceRef

func (r resources) Viewable(_ context.Context, _ actor.Actor, id int) (comment.ResourceRef, error) {
	ref, ok := r[id]
	if !ok {
		return comment.ResourceRef{}, download.ErrResourceNotFound
	}
	return ref, nil
}

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
	commented := resources{20: {ID: 20, GameID: 10, CreatorID: alice.UserID}}
	service := comment.NewService(comment.Deps{
		Repo:      repo,
		Games:     cards,
		Resources: commented,
		Messages:  &moderationtest.Messages{},
		Queue:     queue,
		Tx:        &txtest.Immediate{},
	})
	pins := comment.NewPinService(repo, commented, &txtest.Immediate{}, func() time.Time { return apitest.Now })
	commenthttp.NewHandler(service, pins, server.Builder).Register(server.API)
	return env{server: server, repo: repo, queue: queue}
}

func body(content string, extra string) string {
	return `{"content":` + content + extra + `}`
}

func TestCreateReturnsThePendingComment(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/game/10", As: &alice, Body: body(contentJSON, "")})
	e.server.Expect(resp, http.StatusCreated, 0)
	want := `{"id":1,"content":` + contentJSON + `,"text":"` + paragraph + `","parent_id":null,"parent":null,"root_id":1,"creator":` + alicePublic + `,"status":2,"created":` + stamp + `,"updated":` + stamp + `,"like_count":0}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body\n got %s\nwant %s", resp.Data, want)
	}
	if jobs := e.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ScreenComment{CommentID: 1}) {
		t.Fatalf("expected a screening job, got %+v", jobs)
	}

	reply := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/game/10", As: &bob, Body: body(contentJSON, `,"parent_id":1`)})
	e.server.Expect(reply, http.StatusCreated, 0)
	if !strings.Contains(string(reply.Data), `"parent_id":1,"parent":{"id":1,"text":"`+paragraph+`","creator":`+alicePublic+`},"root_id":1,"creator":`+bobPublic) {
		t.Fatalf("unexpected reply %s", reply.Data)
	}
}

func TestCreateValidation(t *testing.T) {
	e := setup(t)
	long := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"` + strings.Repeat("a", 10001) + `"}]}]}`
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
		{"legacy editor state", &alice, "/comment/game/10", body(`{"root":{"type":"root","children":[]}}`, ""), http.StatusUnprocessableEntity, 100101, ""},
		{"unknown node", &alice, "/comment/game/10", body(`{"type":"doc","content":[{"type":"image"}]}`, ""), http.StatusUnprocessableEntity, 100101, `"field":"content.content[0].type"`},
		{"text outside a paragraph", &alice, "/comment/game/10", body(`{"type":"doc","content":[{"type":"text","text":"x"}]}`, ""), http.StatusUnprocessableEntity, 100101, `a \"text\" node cannot be placed there`},
		{"script link", &alice, "/comment/game/10", body(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}]}`, ""), http.StatusUnprocessableEntity, 100101, "not an http, https or mailto address"},
		{"nothing written", &alice, "/comment/game/10", body(`{"type":"doc","content":[{"type":"paragraph"}]}`, ""), http.StatusUnprocessableEntity, 100101, `"field":"content","messages":["content 不能为空"]`},
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
	want := `{"id":1,"content":` + contentJSON + `,"text":"` + paragraph + `","parent_id":null,"root_id":1,"creator":` + alicePublic + `,"edited":true,"status":2,"created":` + stamp + `,"updated":` + stamp + `}`
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
	html := "root"
	root := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, Content: json.RawMessage(`{"type":"doc","content":[{"type":"paragraph"}]}`), Text: html, Status: comment.StatusVisible})
	_ = e.repo.SetRoot(t.Context(), root.ID, root.ID)
	reply := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 2, Text: html, ParentID: &root.ID, RootID: &root.ID, ReplyCount: 0, Status: comment.StatusPending})
	if _, err := e.repo.AddLike(t.Context(), root.ID, 2); err != nil {
		t.Fatal(err)
	}

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?page=1&pageSize=5", As: &bob})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":1,"content":{"type":"doc","content":[{"type":"paragraph"}]},"text":"root","parent_id":null,"root_id":1,"reply_count":0,"parent":{"id":null},"is_liked":true,"like_count":1,"creator":` + alicePublic + `,"edited":false,"status":1,"pinned":false,"created":` + stamp + `,"updated":` + stamp + `,"replies":[` +
		`{"id":` + strconv.Itoa(reply.ID) + `,"content":null,"text":"root","parent_id":1,"root_id":1,"reply_count":0,"parent":{"id":1,"text":"root","creator":` + alicePublic + `},"is_liked":false,"like_count":0,"creator":` + bobPublic + `,"edited":false,"status":2,"pinned":false,"created":` + stamp + `,"updated":` + stamp + `}` +
		`]}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":5,"totalPages":1,"currentPage":1,"comments":2,"pinned":null}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", resp.Data, want)
	}
	guest := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10"})
	e.server.Expect(guest, http.StatusOK, 0)
	if !strings.Contains(string(guest.Data), `"comments":1`) || !strings.Contains(string(guest.Data), `"replies":[]`) || !strings.Contains(string(guest.Data), `"is_liked":false`) {
		t.Fatalf("guests only see visible comments: %s", guest.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?order=oldest"}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?order=best"}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?focus=0"}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}

func TestListByGameOpensThePageOfAFocusedComment(t *testing.T) {
	e := setup(t)
	var roots []comment.Comment
	for range 3 {
		root := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, Text: "root", Status: comment.StatusVisible})
		_ = e.repo.SetRoot(t.Context(), root.ID, root.ID)
		roots = append(roots, root)
	}
	reply := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 2, Text: "reply", ParentID: &roots[0].ID, RootID: &roots[0].ID, Status: comment.StatusVisible})
	hidden := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 2, Text: "pending", Status: comment.StatusPending})

	focused := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?pageSize=1&focus=" + strconv.Itoa(reply.ID)})
	e.server.Expect(focused, http.StatusOK, 0)
	if !strings.Contains(string(focused.Data), `"currentPage":3`) || !strings.HasPrefix(string(focused.Data), `{"items":[{"id":`+strconv.Itoa(roots[0].ID)+`,`) {
		t.Fatalf("the page of the thread that holds the reply is answered: %s", focused.Data)
	}
	unseen := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10?pageSize=1&page=2&focus=" + strconv.Itoa(hidden.ID)})
	e.server.Expect(unseen, http.StatusOK, 0)
	if !strings.Contains(string(unseen.Data), `"currentPage":2`) {
		t.Fatalf("a comment the viewer cannot see leaves the requested page: %s", unseen.Data)
	}
}

func TestListByUserShape(t *testing.T) {
	e := setup(t)
	html := "mine"
	e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, Text: html, Status: comment.StatusVisible})
	e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, Text: html, Status: comment.StatusPending})

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/comments", As: &alice})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":1,"content":null,"text":"mine","parent_id":null,"root_id":null,"reply_count":0,"parent":null,"is_liked":false,"like_count":0,` +
		`"game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[{"language":"","type":"","url":"a.webp","dims":[],"thumb_hash":null,"sexual":0,"violence":0,"masked":false}],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[],"resources":{"count":0,"downloads":0,"platforms":[],"languages":[],"latest":null},"tags":[]},` +
		`"resource":null,"creator":` + alicePublic + `,"created":` + stamp + `,"updated":` + stamp + `}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1,"is_current_user":true}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected user comments\n got %s\nwant %s", resp.Data, want)
	}
	answered := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 2, Text: "asked", Content: json.RawMessage(`{"type":"doc","content":[{"type":"paragraph"}]}`), Status: comment.StatusVisible})
	e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, Text: "answer", ParentID: &answered.ID, RootID: &answered.ID, Status: comment.StatusVisible})
	replies := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/comments?pageSize=1", As: &alice})
	if !strings.Contains(string(replies.Data), `"parent":{"id":`+strconv.Itoa(answered.ID)+`,"content":{"type":"doc","content":[{"type":"paragraph"}]},"text":"asked","creator":`+bobPublic+`}`) {
		t.Fatalf("a reply carries the document of the comment it answers: %s", replies.Data)
	}
	other := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/comments", As: &bob})
	if !strings.Contains(string(other.Data), `"is_current_user":false`) || !strings.Contains(string(other.Data), `"url":"b.webp"`) {
		t.Fatalf("rated viewers see every cover and are not the owner: %s", other.Data)
	}
}

func TestCommentsOnAResourceAndThePinnedOne(t *testing.T) {
	e := setup(t)
	e.repo.AddResource(20, true)
	missing := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/resource/99", As: &bob, Body: body(contentJSON, "")})
	e.server.Expect(missing, http.StatusNotFound, 440101)
	guest := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/resource/20", Body: body(contentJSON, "")})
	e.server.Expect(guest, http.StatusUnauthorized, 200101)

	first := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/resource/20", As: &bob, Body: body(contentJSON, "")})
	e.server.Expect(first, http.StatusCreated, 0)
	second := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/resource/20", As: &alice, Body: body(contentJSON, "")})
	e.server.Expect(second, http.StatusCreated, 0)
	onGame := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/comment/game/10", As: &bob, Body: body(contentJSON, "")})
	e.server.Expect(onGame, http.StatusCreated, 0)
	for _, id := range []int{1, 2, 3} {
		if err := e.repo.SetStatus(context.Background(), id, comment.StatusVisible); err != nil {
			t.Fatal(err)
		}
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/comment/1/pin"}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/comment/1/pin", As: &bob}), http.StatusForbidden, 470106)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/comment/3/pin", As: &alice}), http.StatusBadRequest, 470105)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/comment/1/pin", As: &alice}), http.StatusOK, 0)

	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/resource/20?order=newest"})
	e.server.Expect(list, http.StatusOK, 0)
	var page struct {
		Items []struct {
			ID     int  `json:"id"`
			Pinned bool `json:"pinned"`
		} `json:"items"`
		Meta struct {
			Comments   int  `json:"comments"`
			TotalItems int  `json:"totalItems"`
			Pinned     *int `json:"pinned"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(list.Data, &page); err != nil {
		t.Fatal(err)
	}
	if page.Meta.Pinned == nil || *page.Meta.Pinned != 1 || page.Meta.Comments != 2 || page.Meta.TotalItems != 2 || len(page.Items) != 2 || page.Items[0].ID != 1 || !page.Items[0].Pinned || page.Items[1].ID != 2 || page.Items[1].Pinned {
		t.Fatalf("the pinned comment leads the resource's own threads: %s", list.Data)
	}
	ofGame := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/game/10"})
	if !strings.Contains(string(ofGame.Data), `"totalItems":1`) || !strings.Contains(string(ofGame.Data), `"pinned":false`) {
		t.Fatalf("the game lists only its own comments: %s", ofGame.Data)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/comment/1/pin", As: &bob}), http.StatusForbidden, 470106)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/comment/1/pin", As: &alice}), http.StatusOK, 0)
	after := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/resource/20"})
	if strings.Contains(string(after.Data), `"pinned":true`) {
		t.Fatalf("unpinned: %s", after.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/comment/resource/99"}), http.StatusNotFound, 440101)
}
