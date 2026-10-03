package walkthroughhttp_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

type adminStore struct {
	entries []walkthrough.AdminEntry
	total   int
	details map[int]walkthrough.AdminDetail
	filter  walkthrough.AdminFilter
	page    walkthrough.Page
}

func (s *adminStore) Search(_ context.Context, filter walkthrough.AdminFilter, page walkthrough.Page) ([]walkthrough.AdminEntry, int, error) {
	s.filter, s.page = filter, page
	return s.entries, s.total, nil
}

func (s *adminStore) Detail(_ context.Context, id int) (walkthrough.AdminDetail, error) {
	detail, ok := s.details[id]
	if !ok {
		return walkthrough.AdminDetail{}, walkthrough.ErrNotFound
	}
	return detail, nil
}

type adminEnv struct {
	server *apitest.Server
	repo   *walkthroughtest.MemoryRepository
	store  *adminStore
	queue  *moderationtest.Queue
}

func setupAdmin(t *testing.T) adminEnv {
	t.Helper()
	server := apitest.New(t)
	repo := walkthroughtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	store := &adminStore{details: map[int]walkthrough.AdminDetail{}}
	queue := &moderationtest.Queue{}
	walkthroughhttp.NewAdminHandler(walkthrough.NewAdminService(repo, store, queue, &txtest.Immediate{}), server.Builder).Register(server.API)
	return adminEnv{server: server, repo: repo, store: store, queue: queue}
}

func optional[T any](value T) *T {
	return &value
}

func sampleEntry() walkthrough.AdminEntry {
	return walkthrough.AdminEntry{
		Walkthrough: walkthrough.Walkthrough{
			ID: 4, GameID: 10, Title: "Route guide", HTML: "<p>guide</p>", Lang: optional("zh"),
			Created: apitest.Now, Updated: apitest.Now, Edited: true, Status: walkthrough.StatusHidden, CreatorID: 1,
		},
		Creator:      user.Summary{ID: 1, Name: "alice"},
		CreatorEmail: "alice@example.test",
		Game:         walkthrough.GameRef{ID: 10, TitleJP: "タイトル", TitleZH: "标题"},
		Moderation: &moderation.Event{
			ID: 2, Auditor: moderation.AuditorReview, Model: "gpt", Decision: moderation.DecisionBlock, TopCategory: moderation.CategorySpam,
			MaxScore: optional(0.75), Reason: optional("ads"), Created: apitest.Now,
		},
	}
}

const (
	adminCreator = `{"id":1,"name":"alice","avatar":null,"is_sponsor":false,"email":"alice@example.test"}`
	adminGame    = `{"id":10,"title_jp":"タイトル","title_zh":"标题","title_en":""}`
)

func TestAdminListShapeAndFilters(t *testing.T) {
	e := setupAdmin(t)
	plain := sampleEntry()
	plain.ID, plain.Lang, plain.Edited, plain.Status, plain.Moderation = 5, nil, false, walkthrough.StatusPublished, nil
	e.store.entries, e.store.total = []walkthrough.AdminEntry{sampleEntry(), plain}, 2

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/walkthroughs?pageSize=5&search=guide&sortBy=title&sortOrder=asc&status=HIDDEN&creatorId=1&gameId=10", As: &admin})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":4,"title":"Route guide","html":"<p>guide</p>","lang":"zh","edited":true,"status":"HIDDEN","created":` + stamp + `,"updated":` + stamp + `,"creator":` + adminCreator + `,"game":` + adminGame + `,` +
		`"moderation":{"id":2,"decision":"BLOCK","model":"gpt","top_category":"SPAM","max_score":0.75,"reason":"ads","created_at":` + stamp + `}},` +
		`{"id":5,"title":"Route guide","html":"<p>guide</p>","lang":null,"edited":false,"status":"PUBLISHED","created":` + stamp + `,"updated":` + stamp + `,"creator":` + adminCreator + `,"game":` + adminGame + `}` +
		`],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":5,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected page\n got %s\nwant %s", resp.Data, want)
	}
	filter := e.store.filter
	if filter.Search != "guide" || filter.SortBy != walkthrough.SortByTitle || filter.Descending || filter.Status == nil || *filter.Status != walkthrough.StatusHidden ||
		filter.CreatorID == nil || *filter.CreatorID != 1 || filter.GameID == nil || *filter.GameID != 10 || e.store.page != (walkthrough.Page{Number: 1, Size: 5}) {
		t.Fatalf("unexpected filter %+v page %+v", filter, e.store.page)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/walkthroughs", As: &admin}), http.StatusOK, 0)
	if filter := e.store.filter; filter.SortBy != walkthrough.SortByCreated || !filter.Descending || filter.Status != nil || filter.CreatorID != nil || filter.GameID != nil {
		t.Fatalf("unexpected defaults %+v", filter)
	}
	for _, query := range []string{"status=GONE", "sortBy=lang", "sortOrder=DESC", "page=0"} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/walkthroughs?" + query, As: &admin}), http.StatusUnprocessableEntity, 100101)
	}
}

func TestAdminRoutesRequireAdmins(t *testing.T) {
	e := setupAdmin(t)
	routes := []apitest.Request{
		{Method: http.MethodGet, Path: "/admin/walkthroughs"},
		{Method: http.MethodGet, Path: "/admin/walkthroughs/1"},
		{Method: http.MethodPatch, Path: "/admin/walkthroughs/1/status", Body: map[string]any{"status": "HIDDEN"}},
		{Method: http.MethodPost, Path: "/admin/walkthroughs/1/rescan"},
	}
	for _, route := range routes {
		e.server.Expect(e.server.Do(route), http.StatusUnauthorized, 200101)
		route.As = &author
		e.server.Expect(e.server.Do(route), http.StatusForbidden, 403)
	}
}

func TestAdminDetailShape(t *testing.T) {
	e := setupAdmin(t)
	entry := sampleEntry()
	entry.Content = json.RawMessage(`{"root":{"type":"root","children":[]}}`)
	e.store.details[4] = walkthrough.AdminDetail{AdminEntry: entry, Moderations: []moderation.Event{{
		ID: 2, Auditor: moderation.AuditorReview, Model: "gpt", Decision: moderation.DecisionBlock, TopCategory: moderation.CategorySpam,
		Categories: json.RawMessage(`{"spam":true}`), MaxScore: optional(0.0), Evidence: optional("link"), Created: apitest.Now,
	}}}
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/walkthroughs/4", As: &admin})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"id":4,"title":"Route guide","html":"<p>guide</p>","content":{"root":{"type":"root","children":[]}},"lang":"zh","edited":true,"status":"HIDDEN",` +
		`"created":` + stamp + `,"updated":` + stamp + `,"creator":` + adminCreator + `,"game":` + adminGame + `,"moderations":[` +
		`{"id":2,"audit_by":2,"model":"gpt","decision":"BLOCK","top_category":"SPAM","categories_json":{"spam":true},"scores_json":null,"max_score":0,"evidence":"link","created_at":` + stamp + `}]}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected detail\n got %s\nwant %s", resp.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/walkthroughs/9", As: &admin}), http.StatusNotFound, 560101)
}

func TestAdminStatusAndRescan(t *testing.T) {
	e := setupAdmin(t)
	published := e.repo.Seed(walkthrough.Walkthrough{GameID: 10, Title: "guide", CreatorID: 1, Status: walkthrough.StatusPublished})
	deleted := e.repo.Seed(walkthrough.Walkthrough{GameID: 10, Title: "gone", CreatorID: 1, Status: walkthrough.StatusDeleted})
	path := "/admin/walkthroughs/" + strconv.Itoa(published.ID)

	resp := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path + "/status", As: &admin, Body: map[string]any{"status": "HIDDEN"}})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("status change returns no data: %s", resp.Body)
	}
	if got, _ := e.repo.Get(t.Context(), published.ID); got.Status != walkthrough.StatusHidden {
		t.Fatalf("status not persisted: %+v", got)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path + "/status", As: &admin, Body: map[string]any{"status": "HIDDEN"}}), http.StatusOK, 0)
	for _, invalid := range []map[string]any{{"status": "hidden"}, {}, {"status": "HIDDEN", "notify": true}} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path + "/status", As: &admin, Body: invalid}), http.StatusUnprocessableEntity, 100101)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/walkthroughs/99/status", As: &admin, Body: map[string]any{"status": "HIDDEN"}}), http.StatusNotFound, 560101)

	rescan := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/rescan", As: &admin})
	e.server.Expect(rescan, http.StatusCreated, 0)
	if rescan.HasData {
		t.Fatalf("rescan returns no data: %s", rescan.Body)
	}
	if got, _ := e.repo.Get(t.Context(), published.ID); got.Status != walkthrough.StatusHidden {
		t.Fatalf("rescan must not change the status: %+v", got)
	}
	if jobs := e.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ReviewWalkthrough{WalkthroughID: published.ID}) {
		t.Fatalf("unexpected jobs %+v", jobs)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/walkthroughs/" + strconv.Itoa(deleted.ID) + "/rescan", As: &admin}), http.StatusNotFound, 560101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/walkthroughs/99/rescan", As: &admin}), http.StatusNotFound, 560101)
	if len(e.queue.All()) != 1 {
		t.Fatalf("missing or deleted walkthroughs are not queued: %+v", e.queue.All())
	}
}
