package walkthroughhttp_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

var (
	author   = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	stranger = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin    = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitShowSpoiler}
)

const (
	authorPublic = `{"id":1,"name":"alice","avatar":null,"is_sponsor":false}`
	stamp        = `"2026-10-03T01:02:03Z"`
	contentJSON  = `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"Choose option A first then go to the beach"}]}]}}`
	renderedHTML = `<p class=\"[&amp;:not(:first-child)]:mt-6\"><span>Choose option A first then go to the beach</span></p>`
)

type env struct {
	server *apitest.Server
	repo   *walkthroughtest.MemoryRepository
	queue  *moderationtest.Queue
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	repo := walkthroughtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.AddUser(user.Summary{ID: 1, Name: "alice"})
	repo.AddGame(10, false)
	cards := gametest.NewCards(game.Card{ID: 10, TitleJP: "タイトル", Covers: []game.Cover{{URL: "a.webp"}, {URL: "b.webp", Sexual: 1}}})
	queue := &moderationtest.Queue{}
	service := walkthrough.NewService(repo, cards, &moderationtest.Activities{}, queue, &txtest.Immediate{})
	walkthroughhttp.NewHandler(service, server.Builder).Register(server.API)
	return env{server: server, repo: repo, queue: queue}
}

func createBody(status string) string {
	return `{"game_id":10,"title":"Route guide","content":` + contentJSON + `,"status":"` + status + `"}`
}

func TestCreateAndUpdate(t *testing.T) {
	e := setup(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/walkthrough", As: &author, Body: createBody("PUBLISHED")})
	e.server.Expect(resp, http.StatusCreated, 0)
	want := `{"id":1,"title":"Route guide","html":"` + renderedHTML + `","lang":"en","created":` + stamp + `,"updated":` + stamp + `,"edited":false,"status":"HIDDEN","creator":` + authorPublic + `}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body\n got %s\nwant %s", resp.Data, want)
	}
	if jobs := e.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: 1}) {
		t.Fatalf("expected a review job, got %+v", jobs)
	}

	update := `{"title":"Route guide","content":` + contentJSON + `,"status":"DRAFT"}`
	updated := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/walkthrough/1", As: &author, Body: update})
	e.server.Expect(updated, http.StatusOK, 0)
	if !strings.Contains(string(updated.Data), `"edited":true,"status":"DRAFT"`) || len(e.queue.All()) != 1 {
		t.Fatalf("unexpected update %s", updated.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/walkthrough/1", As: &stranger, Body: update}), http.StatusForbidden, 560102)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/walkthrough/9", As: &author, Body: update}), http.StatusNotFound, 560101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/walkthrough/1", As: &author, Body: `{"title":"x","content":` + contentJSON + `}`}), http.StatusUnprocessableEntity, 100101)
}

func TestCreateValidation(t *testing.T) {
	e := setup(t)
	cases := []struct {
		name   string
		as     *actor.Actor
		body   string
		status int
		code   int
	}{
		{"unauthenticated", nil, createBody("DRAFT"), http.StatusUnauthorized, 200101},
		{"unknown status", &author, createBody("LIVE"), http.StatusUnprocessableEntity, 100101},
		{"empty title", &author, `{"game_id":10,"title":"","content":` + contentJSON + `,"status":"DRAFT"}`, http.StatusUnprocessableEntity, 100101},
		{"long title", &author, `{"game_id":10,"title":"` + strings.Repeat("t", 256) + `","content":` + contentJSON + `,"status":"DRAFT"}`, http.StatusUnprocessableEntity, 100101},
		{"content is not a document", &author, `{"game_id":10,"title":"t","content":[],"status":"DRAFT"}`, http.StatusUnprocessableEntity, 100101},
		{"missing game", &author, `{"game_id":99,"title":"t","content":` + contentJSON + `,"status":"DRAFT"}`, http.StatusNotFound, 400101},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/walkthrough", As: c.as, Body: c.body}), c.status, c.code)
		})
	}
}

func TestGetAndDelete(t *testing.T) {
	e := setup(t)
	content := json.RawMessage(contentJSON)
	e.repo.Seed(walkthrough.Walkthrough{GameID: 10, CreatorID: 1, Title: "h", HTML: "<p>h</p>", Content: content, Status: walkthrough.StatusHidden})

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1"}), http.StatusForbidden, 560102)
	plain := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1", As: &author})
	e.server.Expect(plain, http.StatusOK, 0)
	if strings.Contains(string(plain.Data), `"content"`) {
		t.Fatalf("content is only included on request: %s", plain.Data)
	}
	withContent := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1?withContent=true", As: &admin})
	e.server.Expect(withContent, http.StatusOK, 0)
	if !strings.HasSuffix(string(withContent.Data), `"creator":`+authorPublic+`,"content":`+contentJSON+`}`) {
		t.Fatalf("unexpected body %s", withContent.Data)
	}
	if body := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1?withContent=yes", As: &author}); strings.Contains(string(body.Data), `"content"`) {
		t.Fatal("only the literal true includes content")
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/walkthrough/1", As: &stranger}), http.StatusForbidden, 560102)
	deleted := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/walkthrough/1", As: &author})
	e.server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1", As: &author}), http.StatusNotFound, 560101)
}

func TestListByGameAndUser(t *testing.T) {
	e := setup(t)
	e.repo.Seed(walkthrough.Walkthrough{GameID: 10, CreatorID: 1, Title: "published", Status: walkthrough.StatusPublished})
	e.repo.Seed(walkthrough.Walkthrough{GameID: 10, CreatorID: 1, Title: "draft", Status: walkthrough.StatusDraft})

	guest := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/game/10?pageSize=5"})
	e.server.Expect(guest, http.StatusOK, 0)
	want := `{"items":[{"id":1,"title":"published","lang":null,"created":` + stamp + `,"updated":` + stamp + `,"edited":false,"status":"PUBLISHED","creator":` + authorPublic + `}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":5,"totalPages":1,"currentPage":1,"content_limit":0}}`
	if string(guest.Data) != want {
		t.Fatalf("unexpected game listing\n got %s\nwant %s", guest.Data, want)
	}
	staff := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/game/10?status=DRAFT", As: &admin})
	if !strings.Contains(string(staff.Data), `"title":"draft"`) || !strings.Contains(string(staff.Data), `"content_limit":2`) {
		t.Fatalf("admins can filter drafts: %s", staff.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/game/10?status=LIVE"}), http.StatusUnprocessableEntity, 100101)

	own := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/walkthroughs", As: &author})
	e.server.Expect(own, http.StatusOK, 0)
	wantOwn := `{"items":[` +
		`{"id":2,"title":"draft","lang":null,"created":` + stamp + `,"updated":` + stamp + `,"edited":false,"status":"DRAFT","game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[{"language":"","type":"","url":"a.webp","dims":[],"sexual":0,"violence":0}],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]},"creator":` + authorPublic + `},` +
		`{"id":1,"title":"published","lang":null,"created":` + stamp + `,"updated":` + stamp + `,"edited":false,"status":"PUBLISHED","game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[{"language":"","type":"","url":"a.webp","dims":[],"sexual":0,"violence":0}],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[]},"creator":` + authorPublic + `}` +
		`],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":10,"totalPages":1,"currentPage":1,"is_current_user":true,"content_limit":1}}`
	if string(own.Data) != wantOwn {
		t.Fatalf("unexpected user listing\n got %s\nwant %s", own.Data, wantOwn)
	}
	other := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/walkthroughs?status=DRAFT", As: &stranger})
	if !strings.Contains(string(other.Data), `"totalItems":1`) || !strings.Contains(string(other.Data), `"is_current_user":false`) {
		t.Fatalf("others only see published walkthroughs: %s", other.Data)
	}
}
