package translatorhttp_test

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func TestAdminRoutesRequireAdmins(t *testing.T) {
	server, _ := setup(t)
	for _, request := range []apitest.Request{
		{Method: http.MethodGet, Path: "/admin/content/translators"},
		{Method: http.MethodGet, Path: "/admin/content/translators/duplicates"},
		{Method: http.MethodPost, Path: "/admin/content/translators/duplicates/dismiss", Body: map[string]any{"ids": []int{1, 2}}},
		{Method: http.MethodPatch, Path: "/admin/content/translators/1", Body: map[string]any{"name": "x"}},
		{Method: http.MethodPost, Path: "/admin/content/translators/1/merge", Body: map[string]any{"merged_ids": []int{2}}},
	} {
		server.Expect(server.Do(request), http.StatusUnauthorized, 200101)
		request.As = &user
		server.Expect(server.Do(request), http.StatusForbidden, 403)
	}
}

func TestAdminListShapeAndValidation(t *testing.T) {
	server, repo := setup(t)
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组", Aliases: []string{"Green Tea"}, Homepage: ptr("https://tea.example")})
	repo.Seed(translator.Translator{Name: "闲置汉化组"})
	repo.Credit(1, true, day, tea.ID)
	repo.Credit(1, false, day, tea.ID)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/translators?sortBy=resources", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":1,"name":"绿茶汉化组","aliases":["Green Tea"],"homepage":"https://tea.example","works_count":1,"resources_count":2,"latest_credit":"2026-05-15T01:02:03.000Z"},` +
		`{"id":2,"name":"闲置汉化组","aliases":[],"homepage":null,"works_count":0,"resources_count":0,"latest_credit":null}` +
		`],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected page\n got %s\nwant %s", resp.Data, want)
	}
	resp = server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/translators?search=闲置&sortBy=name&sortOrder=asc", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	if got := string(resp.Data); got[:len(`{"items":[{"id":2,`)] != `{"items":[{"id":2,` {
		t.Fatalf("search %s", got)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/translators?sortBy=created", As: &admin}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminEditMergeAndDuplicates(t *testing.T) {
	server, repo := setup(t)
	kept := repo.Seed(translator.Translator{Name: "破琵琶生产公社汉化组"})
	short := repo.Seed(translator.Translator{Name: "破琵琶生产公社"})
	other := repo.Seed(translator.Translator{Name: "绿茶汉化组"})
	resource := repo.Credit(1, true, day, short.ID)
	path := func(id int) string { return "/admin/content/translators/" + strconv.Itoa(id) }

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/translators/duplicates", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `[{"translators":[` +
		`{"id":2,"name":"破琵琶生产公社","aliases":[],"homepage":null,"works_count":1,"resources_count":1,"latest_credit":"2026-05-15T01:02:03.000Z"},` +
		`{"id":1,"name":"破琵琶生产公社汉化组","aliases":[],"homepage":null,"works_count":0,"resources_count":0,"latest_credit":null}]}]`
	if string(resp.Data) != want {
		t.Fatalf("unexpected clusters\n got %s\nwant %s", resp.Data, want)
	}

	resp = server.Do(apitest.Request{Method: http.MethodPatch, Path: path(kept.ID), As: &admin, Body: map[string]any{"aliases": []string{"破琵琶"}, "homepage": "https://pipa.example"}})
	server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("edit omits data: %s", resp.Body)
	}
	if stored, _ := repo.Get(t.Context(), kept.ID); len(stored.Aliases) != 1 || stored.Homepage == nil || *stored.Homepage != "https://pipa.example" {
		t.Fatalf("stored %+v", stored)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: path(kept.ID), As: &admin, Body: map[string]any{"homepage": ""}}), http.StatusOK, 0)
	if stored, _ := repo.Get(t.Context(), kept.ID); stored.Homepage != nil {
		t.Fatalf("an empty homepage clears it: %+v", stored)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: path(kept.ID), As: &admin, Body: map[string]any{"name": "绿茶汉化组"}}), http.StatusConflict, 600102)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: path(kept.ID), As: &admin, Body: map[string]any{"name": ""}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: path(404), As: &admin, Body: map[string]any{"name": "x"}}), http.StatusNotFound, 600101)

	resp = server.Do(apitest.Request{Method: http.MethodPost, Path: path(kept.ID) + "/merge", As: &admin, Body: map[string]any{"merged_ids": []int{short.ID}}})
	server.Expect(resp, http.StatusOK, 0)
	if got := repo.Credited(resource); len(got) != 1 || got[0] != kept.ID {
		t.Fatalf("credits %v", got)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: path(kept.ID) + "/merge", As: &admin, Body: map[string]any{"merged_ids": []int{kept.ID}}}), http.StatusBadRequest, 600104)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: path(kept.ID) + "/merge", As: &admin, Body: map[string]any{"merged_ids": []int{}}}), http.StatusUnprocessableEntity, 100101)

	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/content/translators/duplicates/dismiss", As: &admin, Body: map[string]any{"ids": []int{kept.ID, other.ID}}}), http.StatusOK, 0)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/content/translators/duplicates/dismiss", As: &admin, Body: map[string]any{"ids": []int{kept.ID}}}), http.StatusUnprocessableEntity, 100101)
}
