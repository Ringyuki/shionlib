package commenthttp_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment/commenttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/commenthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var moderator = actor.Actor{UserID: 9, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}

type adminStore struct {
	entries []comment.AdminEntry
	total   int
	details map[int]comment.AdminDetail
	filter  comment.AdminFilter
	page    comment.Page
}

func (s *adminStore) Search(_ context.Context, filter comment.AdminFilter, page comment.Page) ([]comment.AdminEntry, int, error) {
	s.filter, s.page = filter, page
	return s.entries, s.total, nil
}

func (s *adminStore) Detail(_ context.Context, id int) (comment.AdminDetail, error) {
	detail, ok := s.details[id]
	if !ok {
		return comment.AdminDetail{}, comment.ErrNotFound
	}
	return detail, nil
}

func (s *adminStore) HasActivity(context.Context, int) (bool, error) {
	return false, nil
}

func (s *adminStore) HasReplyNotice(context.Context, int, int) (bool, error) {
	return false, nil
}

type adminEnv struct {
	server   *apitest.Server
	repo     *commenttest.MemoryRepository
	store    *adminStore
	messages *moderationtest.Messages
	queue    *moderationtest.Queue
}

func setupAdmin(t *testing.T) adminEnv {
	t.Helper()
	server := apitest.New(t)
	repo := commenttest.NewMemoryRepository(func() time.Time { return apitest.Now })
	store := &adminStore{details: map[int]comment.AdminDetail{}}
	messages, queue := &moderationtest.Messages{}, &moderationtest.Queue{}
	service := comment.NewAdminService(repo, store, messages, &moderationtest.Activities{}, queue, &txtest.Immediate{})
	commenthttp.NewAdminHandler(service, server.Builder).Register(server.API)
	return adminEnv{server: server, repo: repo, store: store, messages: messages, queue: queue}
}

func text(value string) *string {
	return &value
}

func score(value float64) *float64 {
	return &value
}

func sampleEntries() []comment.AdminEntry {
	parentID := 4
	sponsorUntil := apitest.Now.Add(time.Hour)
	return []comment.AdminEntry{
		{
			Comment: comment.Comment{
				ID: 5, HTML: text("<p>reply</p>"), GameID: 10, ParentID: &parentID, RootID: &parentID, CreatorID: 1,
				Status: comment.StatusPending, Edited: true, Created: apitest.Now, Updated: apitest.Now,
			},
			Creator:      user.Summary{ID: 1, Name: "alice"},
			CreatorEmail: "alice@example.test",
			Parent:       &comment.ParentRef{ID: 4, HTML: text("<p>root</p>"), Creator: user.Summary{ID: 2, Name: "bob", SponsorExpiresAt: &sponsorUntil}},
			Game:         comment.GameRef{ID: 10, TitleJP: "タイトル"},
			LikeCount:    3,
			Moderation: &moderation.Event{
				ID: 7, Auditor: moderation.AuditorScreening, Model: "omni", Decision: moderation.DecisionReview, TopCategory: moderation.CategoryHate,
				MaxScore: score(0), Evidence: text(""), Created: apitest.Now,
			},
		},
		{
			Comment:      comment.Comment{ID: 4, GameID: 10, CreatorID: 2, Status: comment.StatusVisible, ReplyCount: 1, Created: apitest.Now, Updated: apitest.Now},
			Creator:      user.Summary{ID: 2, Name: "bob"},
			CreatorEmail: "bob@example.test",
			Game:         comment.GameRef{ID: 10, TitleJP: "タイトル", TitleZH: "标题", TitleEN: "Title"},
		},
	}
}

const (
	adminReplyItem = `{"id":5,"html":"<p>reply</p>","parent_id":4,"root_id":4,"reply_count":0,"like_count":3,` +
		`"creator":{"id":1,"name":"alice","avatar":null,"is_sponsor":false,"email":"alice@example.test"},` +
		`"parent":{"id":4,"html":"<p>root</p>","creator":{"id":2,"name":"bob","avatar":null,"is_sponsor":true}},` +
		`"game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":""},"edited":true,"status":2,"created":` + stamp + `,"updated":` + stamp + `,` +
		`"moderation":{"id":7,"decision":"REVIEW","model":"omni","top_category":"HATE","max_score":0,"evidence":"","created_at":` + stamp + `}}`
	adminRootItem = `{"id":4,"html":null,"parent_id":null,"root_id":null,"reply_count":1,"like_count":0,` +
		`"creator":{"id":2,"name":"bob","avatar":null,"is_sponsor":false,"email":"bob@example.test"},"parent":null,` +
		`"game":{"id":10,"title_jp":"タイトル","title_zh":"标题","title_en":"Title"},"edited":false,"status":1,"created":` + stamp + `,"updated":` + stamp + `}`
)

func TestAdminListShapeAndFilters(t *testing.T) {
	e := setupAdmin(t)
	e.store.entries, e.store.total = sampleEntries(), 3
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/comments?page=1&pageSize=2&search=needle&sortBy=id&sortOrder=asc&status=2&creatorId=1&gameId=0", As: &moderator})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` + adminReplyItem + `,` + adminRootItem + `],"meta":{"totalItems":3,"itemCount":2,"itemsPerPage":2,"totalPages":2,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected page\n got %s\nwant %s", resp.Data, want)
	}
	filter := e.store.filter
	if filter.Search != "needle" || filter.SortBy != comment.SortByID || filter.Descending || filter.Status == nil || *filter.Status != comment.StatusPending ||
		filter.CreatorID == nil || *filter.CreatorID != 1 || filter.GameID != nil || e.store.page != (comment.Page{Number: 1, Size: 2}) {
		t.Fatalf("unexpected filter %+v page %+v", filter, e.store.page)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/comments", As: &moderator}), http.StatusOK, 0)
	if filter := e.store.filter; filter.SortBy != comment.SortByCreated || !filter.Descending || filter.Status != nil || filter.CreatorID != nil || e.store.page != (comment.Page{Number: 1, Size: 10}) {
		t.Fatalf("unexpected defaults %+v page %+v", filter, e.store.page)
	}
}

func TestAdminListValidation(t *testing.T) {
	e := setupAdmin(t)
	for _, query := range []string{"status=4", "status=x", "sortBy=title", "sortOrder=up", "pageSize=51", "creatorId=abc"} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/comments?" + query, As: &moderator}), http.StatusUnprocessableEntity, 100101)
	}
}

func TestAdminRoutesRequireAdmins(t *testing.T) {
	e := setupAdmin(t)
	routes := []apitest.Request{
		{Method: http.MethodGet, Path: "/admin/comments"},
		{Method: http.MethodGet, Path: "/admin/comments/1"},
		{Method: http.MethodPatch, Path: "/admin/comments/1/status", Body: map[string]any{"status": 1}},
		{Method: http.MethodPost, Path: "/admin/comments/1/rescan"},
	}
	for _, route := range routes {
		e.server.Expect(e.server.Do(route), http.StatusUnauthorized, 200101)
		route.As = &alice
		e.server.Expect(e.server.Do(route), http.StatusForbidden, 403)
	}
}

func TestAdminDetailShape(t *testing.T) {
	e := setupAdmin(t)
	entry := sampleEntries()[0]
	entry.Content = json.RawMessage(`{"root":{"type":"root","children":[]}}`)
	e.store.details[5] = comment.AdminDetail{AdminEntry: entry, Moderations: []moderation.Event{
		{
			ID: 8, Auditor: moderation.AuditorReview, Model: "gpt", Decision: moderation.DecisionBlock, TopCategory: moderation.CategorySpam,
			Categories: json.RawMessage(`{"spam":true}`), Scores: json.RawMessage(`{"spam":0.9}`), MaxScore: score(0.9), Reason: text("ads"), Evidence: text("link"), Created: apitest.Now,
		},
		{ID: 7, Auditor: moderation.AuditorScreening, Model: "omni", Decision: moderation.DecisionReview, TopCategory: moderation.CategoryHate, Categories: json.RawMessage(`{}`), Created: apitest.Now},
	}}
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/comments/5", As: &moderator})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"id":5,"html":"<p>reply</p>","content":{"root":{"type":"root","children":[]}},"parent_id":4,"root_id":4,"reply_count":0,"like_count":3,` +
		`"creator":{"id":1,"name":"alice","avatar":null,"is_sponsor":false,"email":"alice@example.test"},` +
		`"parent":{"id":4,"html":"<p>root</p>","creator":{"id":2,"name":"bob","avatar":null,"is_sponsor":true}},` +
		`"game":{"id":10,"title_jp":"タイトル","title_zh":"","title_en":""},"edited":true,"status":2,"created":` + stamp + `,"updated":` + stamp + `,"moderations":[` +
		`{"id":8,"audit_by":2,"model":"gpt","decision":"BLOCK","top_category":"SPAM","categories_json":{"spam":true},"scores_json":{"spam":0.9},"max_score":0.9,"reason":"ads","evidence":"link","created_at":` + stamp + `},` +
		`{"id":7,"audit_by":1,"model":"omni","decision":"REVIEW","top_category":"HATE","categories_json":{},"scores_json":null,"max_score":null,"created_at":` + stamp + `}]}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected detail\n got %s\nwant %s", resp.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/comments/6", As: &moderator}), http.StatusNotFound, 470101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/comments/abc", As: &moderator}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminStatusChangesAndRescan(t *testing.T) {
	e := setupAdmin(t)
	blocked := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 1, Status: comment.StatusVisible})
	quiet := e.repo.Seed(comment.Comment{GameID: 10, CreatorID: 2, Status: comment.StatusVisible})

	resp := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/comments/" + strconv.Itoa(blocked.ID) + "/status", As: &moderator, Body: map[string]any{"status": 3, "top_category": "SPAM", "reason": "ads"}})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("status change returns no data: %s", resp.Body)
	}
	if got, _ := e.repo.Get(t.Context(), blocked.ID); got.Status != comment.StatusBlocked {
		t.Fatalf("status not changed: %+v", got)
	}
	sent := e.messages.All()
	if len(sent) != 1 || sent[0].Type != message.TypeSystem || sent[0].ReceiverID != 1 || sent[0].SenderID == nil || *sent[0].SenderID != moderator.UserID ||
		sent[0].Content != "Messages.System.Moderation.Comment.Block.ReviewContent" || string(sent[0].Meta) != `{"top_category":"SPAM","reason":"ads"}` {
		t.Fatalf("unexpected block notice %+v", sent)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/comments/" + strconv.Itoa(quiet.ID) + "/status", As: &moderator, Body: map[string]any{"status": 3, "notify": false}}), http.StatusOK, 0)
	if len(e.messages.All()) != 1 {
		t.Fatalf("notify=false must not send a notice: %+v", e.messages.All())
	}

	for _, invalid := range []map[string]any{{"status": 4}, {"status": "2"}, {}, {"status": 3, "notify": "false"}, {"status": 3, "top_category": "RUDE"}, {"status": 3, "extra": 1}} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/comments/" + strconv.Itoa(quiet.ID) + "/status", As: &moderator, Body: invalid}), http.StatusUnprocessableEntity, 100101)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/comments/999/status", As: &moderator, Body: map[string]any{"status": 1}}), http.StatusNotFound, 470101)

	rescan := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/comments/" + strconv.Itoa(blocked.ID) + "/rescan", As: &moderator})
	e.server.Expect(rescan, http.StatusCreated, 0)
	if rescan.HasData {
		t.Fatalf("rescan returns no data: %s", rescan.Body)
	}
	if got, _ := e.repo.Get(t.Context(), blocked.ID); got.Status != comment.StatusPending {
		t.Fatalf("rescan resets the status to pending: %+v", got)
	}
	if jobs := e.queue.All(); len(jobs) != 1 || jobs[0] != (moderation.ScreenComment{CommentID: blocked.ID}) {
		t.Fatalf("unexpected jobs %+v", jobs)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/comments/999/rescan", As: &moderator}), http.StatusNotFound, 470101)
}
