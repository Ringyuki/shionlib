package walkthroughhttp_test

import (
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
	stamp        = `"2026-10-03T01:02:03.000Z"`
	noteJSON     = `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Saves before the first one do not matter"}]}]}`
	routesJSON   = `[` +
		`{"key":"a1","name":" Mugi ","characters":[7,9,7],"steps":[{"kind":"note","text":"START"},{"kind":"choice","text":"Left"},{"kind":"save","slot":"01"},{"kind":"gap"},{"kind":"choice","text":"Maid","remark":"Mugi and Hibana"}],"ending":"Mugi END"},` +
		`{"key":"b2","name":"Harem","requires":["a1","zz"],"condition":"Three points each","steps":[{"kind":"load","slot":"01"}]}]`
	routesStored = `[` +
		`{"key":"a1","name":"Mugi","characters":[7,9],"requires":[],"condition":"","ending":"Mugi END","steps":[{"kind":"note","text":"START","remark":"","slot":""},{"kind":"choice","text":"Left","remark":"","slot":""},{"kind":"save","text":"","remark":"","slot":"01"},{"kind":"gap","text":"","remark":"","slot":""},{"kind":"choice","text":"Maid","remark":"Mugi and Hibana","slot":""}]},` +
		`{"key":"b2","name":"Harem","characters":[],"requires":["a1"],"condition":"Three points each","ending":"","steps":[{"kind":"load","text":"","remark":"","slot":"01"}]}]`
	gameCard = `"game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":"","aliases":[],"type":null,"covers":[{"language":"","type":"","url":"a.webp","dims":[],"sexual":0,"violence":0}],"intro_jp":"","intro_zh":"","intro_en":"","release_date":null,"developers":[],"resources":{"count":0,"downloads":0,"platforms":[],"languages":[],"latest":null},"tags":[]}`
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

func written(status string) string {
	return `{"note":` + noteJSON + `,"routes":` + routesJSON + `,"status":"` + status + `"}`
}

func (e env) write(as *actor.Actor, path, body string) apitest.Response {
	return e.server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: as, Body: body})
}

func TestWrite(t *testing.T) {
	e := setup(t)
	resp := e.write(&author, "/walkthrough/game/10/mine", written("PUBLISHED"))
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"id":1,"game_id":10,"note":` + noteJSON + `,"routes":` + routesStored + `,"lang":"en","created":` + stamp + `,"updated":` + stamp + `,"status":"HIDDEN","review_pending":true,"creator":` + authorPublic + `}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body\n got %s\nwant %s", resp.Data, want)
	}
	if jobs := e.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: 1}) {
		t.Fatalf("expected a review job, got %+v", jobs)
	}

	again := e.write(&author, "/walkthrough/game/10/mine", `{"routes":[],"status":"DRAFT"}`)
	e.server.Expect(again, http.StatusOK, 0)
	if string(again.Data) != `{"id":1,"game_id":10,"routes":[],"lang":null,"created":`+stamp+`,"updated":`+stamp+`,"status":"DRAFT","review_pending":false,"creator":`+authorPublic+`}` || len(e.queue.All()) != 1 {
		t.Fatalf("writing again replaces the walkthrough: %s", again.Data)
	}
	other := e.write(&stranger, "/walkthrough/game/10/mine", written("DRAFT"))
	e.server.Expect(other, http.StatusOK, 0)
	if !strings.HasPrefix(string(other.Data), `{"id":2,"game_id":10,`) {
		t.Fatalf("another author writes their own: %s", other.Data)
	}
}

func TestWriteValidation(t *testing.T) {
	e := setup(t)
	route := func(fields string) string {
		return `{"routes":[{"key":"a","name":"Mugi","steps":[{"kind":"choice","text":"Left"}]},` + fields + `],"status":"DRAFT"}`
	}
	cases := []struct {
		name   string
		as     *actor.Actor
		path   string
		body   string
		status int
		code   int
		field  string
	}{
		{"unauthenticated", nil, "/walkthrough/game/10/mine", written("DRAFT"), http.StatusUnauthorized, 200101, ""},
		{"missing game", &author, "/walkthrough/game/99/mine", written("DRAFT"), http.StatusNotFound, 400101, ""},
		{"a status an author cannot give", &author, "/walkthrough/game/10/mine", written("HIDDEN"), http.StatusUnprocessableEntity, 100101, "status"},
		{"no routes", &author, "/walkthrough/game/10/mine", `{"status":"DRAFT"}`, http.StatusUnprocessableEntity, 100101, "routes"},
		{"a note that is not a document", &author, "/walkthrough/game/10/mine", `{"note":[],"routes":[],"status":"DRAFT"}`, http.StatusUnprocessableEntity, 100101, "note"},
		{"a note beyond what a note holds", &author, "/walkthrough/game/10/mine", `{"note":{"type":"doc","content":[{"type":"heading","attrs":{"level":2}}]},"routes":[],"status":"DRAFT"}`, http.StatusUnprocessableEntity, 100101, "note"},
		{"a key twice", &author, "/walkthrough/game/10/mine", route(`{"key":"a","name":"x","steps":[]}`), http.StatusUnprocessableEntity, 100101, "routes[1].key"},
		{"a key of other characters", &author, "/walkthrough/game/10/mine", route(`{"key":"B 2","name":"x","steps":[]}`), http.StatusUnprocessableEntity, 100101, "routes[1].key"},
		{"a long name", &author, "/walkthrough/game/10/mine", route(`{"key":"b","name":"` + strings.Repeat("n", 81) + `","steps":[]}`), http.StatusUnprocessableEntity, 100101, "routes[1].name"},
		{"a choice without text", &author, "/walkthrough/game/10/mine", route(`{"key":"b","name":"x","steps":[{"kind":"choice","text":" "}]}`), http.StatusUnprocessableEntity, 100101, "routes[1].steps[0].text"},
		{"a save without a number", &author, "/walkthrough/game/10/mine", route(`{"key":"b","name":"x","steps":[{"kind":"gap"},{"kind":"save"}]}`), http.StatusUnprocessableEntity, 100101, "routes[1].steps[1].slot"},
		{"a save number that is not one", &author, "/walkthrough/game/10/mine", route(`{"key":"b","name":"x","steps":[{"kind":"load","slot":"A"}]}`), http.StatusUnprocessableEntity, 100101, "routes[1].steps[0].slot"},
		{"an unknown kind of step", &author, "/walkthrough/game/10/mine", route(`{"key":"b","name":"x","steps":[{"kind":"jump","text":"x"}]}`), http.StatusUnprocessableEntity, 100101, "routes[1].steps[0].kind"},
		{"publishing nothing", &author, "/walkthrough/game/10/mine", `{"routes":[],"status":"PUBLISHED"}`, http.StatusUnprocessableEntity, 560104, ""},
		{"publishing a route without steps", &author, "/walkthrough/game/10/mine", `{"routes":[{"key":"a","name":"Mugi","steps":[]}],"status":"PUBLISHED"}`, http.StatusUnprocessableEntity, 560105, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			resp := e.write(c.as, c.path, c.body)
			e.server.Expect(resp, c.status, c.code)
			if c.field != "" && !strings.Contains(string(resp.Data), `"field":"`+c.field+`"`) {
				t.Fatalf("the refusal names %s: %s", c.field, resp.Data)
			}
		})
	}
}

func TestGetAndDelete(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.write(&author, "/walkthrough/game/10/mine", written("PUBLISHED")), http.StatusOK, 0)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1"}), http.StatusForbidden, 560102)
	for _, reader := range []*actor.Actor{&author, &admin} {
		read := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1", As: reader})
		e.server.Expect(read, http.StatusOK, 0)
		if !strings.HasPrefix(string(read.Data), `{"id":1,"game_id":10,"note":`+noteJSON+`,"routes":`+routesStored+`,"lang":"en",`) {
			t.Fatalf("unexpected body %s", read.Data)
		}
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/9"}), http.StatusNotFound, 560101)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/walkthrough/1", As: &stranger}), http.StatusForbidden, 560102)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/walkthrough/1"}), http.StatusUnauthorized, 200101)
	deleted := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/walkthrough/1", As: &author})
	e.server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/1", As: &author}), http.StatusNotFound, 560101)
}

func TestListByGameAndUser(t *testing.T) {
	e := setup(t)
	two := []walkthrough.Route{{Key: "a", Name: "x"}, {Key: "b", Name: "y"}}
	e.repo.Seed(walkthrough.Walkthrough{GameID: 10, CreatorID: 1, Routes: two, Status: walkthrough.StatusPublished})
	e.repo.Seed(walkthrough.Walkthrough{GameID: 10, CreatorID: 2, Status: walkthrough.StatusDraft})

	published := `{"id":1,"route_count":2,"lang":null,"updated":` + stamp + `,"status":"PUBLISHED","review_pending":false,"creator":` + authorPublic + `}`
	guest := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/game/10"})
	e.server.Expect(guest, http.StatusOK, 0)
	if string(guest.Data) != `[`+published+`]` {
		t.Fatalf("unexpected game listing\n got %s", guest.Data)
	}
	own := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/game/10", As: &stranger})
	if want := `[{"id":2,"route_count":0,"lang":null,"updated":` + stamp + `,"status":"DRAFT","review_pending":false,"creator":{"id":2,"name":"","avatar":null,"is_sponsor":false}},` + published + `]`; string(own.Data) != want {
		t.Fatalf("an author is listed their own walkthrough first\n got %s\nwant %s", own.Data, want)
	}
	if none := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/game/99"}); string(none.Data) != `[]` {
		t.Fatalf("a game without walkthroughs: %s", none.Data)
	}

	listed := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/walkthroughs", As: &author})
	e.server.Expect(listed, http.StatusOK, 0)
	wantListed := `{"items":[{"id":1,"route_count":2,"lang":null,"updated":` + stamp + `,"status":"PUBLISHED","review_pending":false,` + gameCard + `}],` +
		`"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1,"is_current_user":true,"content_limit":1}}`
	if string(listed.Data) != wantListed {
		t.Fatalf("unexpected user listing\n got %s\nwant %s", listed.Data, wantListed)
	}
	drafts := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/2/walkthroughs", As: &author})
	if !strings.Contains(string(drafts.Data), `"totalItems":0`) || !strings.Contains(string(drafts.Data), `"is_current_user":false`) {
		t.Fatalf("others only see published walkthroughs: %s", drafts.Data)
	}
	if mine := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/2/walkthroughs", As: &stranger}); !strings.Contains(string(mine.Data), `"status":"DRAFT"`) {
		t.Fatalf("an author is listed their drafts: %s", mine.Data)
	}
}
