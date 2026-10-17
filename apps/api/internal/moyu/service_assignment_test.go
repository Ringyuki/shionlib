package moyu_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
)

type assignmentFixture struct {
	ctx         context.Context
	assignments *moyutest.Assignments
	patches     *moyutest.Patches
	cache       *moyutest.Cache
	service     *moyu.AssignmentService
}

func newAssignmentFixture() *assignmentFixture {
	f := &assignmentFixture{
		ctx: context.Background(),
		assignments: &moyutest.Assignments{Games: map[int]moyu.Game{
			11110: {Anchors: []moyu.Anchor{vndb("v1141"), bangumi("15004")}},
			20549: {Anchors: []moyu.Anchor{vndb("v2240"), bangumi("222174")}},
			27697: {Assigned: true, Pages: []string{"212857", "999"}},
		}},
		patches: &moyutest.Patches{
			Known: map[moyu.Anchor][]string{vndb("v1141"): {"3125"}, bangumi("15004"): {"215305"}, vndb("v2240"): {"10363"}, bangumi("222174"): {"211655"}},
			Catalog: []moyu.Page{
				{ID: "3125", VNDBID: "v1141", WorkID: "3125", Title: "俺たちに翼はない", Resources: 5},
				{ID: "215305", VNDBID: "wiki-215305", WorkID: "215305", Title: "俺たちに翼はない R", Resources: 1},
				{ID: "10363", VNDBID: "v2240", WorkID: "10363", Title: "堕淫フォーカス", Resources: 1},
				{ID: "211655", VNDBID: "wiki-211655", WorkID: "211655", Title: "堕淫フォーカス～精液狂・痴漢好きの少女～", Resources: 1},
				{ID: "211652", VNDBID: "wiki-211652", WorkID: "211652", Title: "堕淫フォーカス～視姦される女教師～", Resources: 1},
				{ID: "212857", VNDBID: "wiki-212857", WorkID: "212857", Title: "プレミアムアーカイブス むとうけいじ", Resources: 1},
			},
			Resources: map[string]string{"11421": "212857"},
		},
		cache: moyutest.NewCache(),
	}
	f.service = moyu.NewAssignmentService(f.assignments, f.patches, f.cache)
	return f
}

func pageIDs(pages []moyu.Page) []string {
	out := []string{}
	for _, page := range pages {
		out = append(out, page.ID)
	}
	return out
}

func TestAnAssignmentShowsWhichIDMatchedEachPage(t *testing.T) {
	f := newAssignmentFixture()
	got, err := f.service.Assignment(f.ctx, 11110)
	if err != nil || got.Game.Assigned || !slices.Equal(pageIDs(got.Matched), []string{"3125", "215305"}) || len(got.Assigned) != 0 {
		t.Fatalf("assignment: %+v %v", got, err)
	}
	if via := got.Matched[0].Via; via == nil || *via != vndb("v1141") {
		t.Fatalf("the page of the vndb id: %+v", via)
	}
	if via := got.Matched[1].Via; via == nil || *via != bangumi("15004") {
		t.Fatalf("the page of the work bangumi files the game under: %+v", via)
	}
	assigned, err := f.service.Assignment(f.ctx, 27697)
	if err != nil || !assigned.Game.Assigned || len(assigned.Matched) != 0 || !slices.Equal(pageIDs(assigned.Assigned), []string{"212857"}) {
		t.Fatalf("a page the other site no longer lists is left out: %+v %v", assigned, err)
	}
	if _, err := f.service.Assignment(f.ctx, 404); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
}

func TestAssigningPagesReplacesWhatTheIDsFind(t *testing.T) {
	f := newAssignmentFixture()
	admin := actor.Actor{UserID: 7}
	_ = f.cache.Set(f.ctx, "moyu:entries:game:20549", []moyu.Entry{{ID: "stale"}}, moyu.CacheTTL)
	if err := f.service.Assign(f.ctx, admin, 20549, true, []string{"10363", "211652", "10363"}); err != nil {
		t.Fatal(err)
	}
	stored := f.assignments.Games[20549]
	if !stored.Assigned || !slices.Equal(stored.Pages, []string{"10363", "211652"}) || f.assignments.By[20549] != 7 {
		t.Fatalf("stored once each, in order, with who assigned them: %+v %v", stored, f.assignments.By)
	}
	if f.cache.Has("moyu:entries:game:20549") {
		t.Fatal("the game page lists the assigned pages at once")
	}
	if err := f.service.Assign(f.ctx, admin, 20549, true, []string{"10363", "2116520"}); !errors.Is(err, moyu.ErrPageNotFound) {
		t.Fatalf("a page the other site does not list: %v", err)
	}
	if !slices.Equal(f.assignments.Games[20549].Pages, []string{"10363", "211652"}) {
		t.Fatalf("a refused assignment changes nothing: %+v", f.assignments.Games[20549])
	}
	if err := f.service.Assign(f.ctx, admin, 20549, true, nil); err != nil || !f.assignments.Games[20549].Assigned || len(f.assignments.Games[20549].Pages) != 0 {
		t.Fatalf("no pages at all hides the patches: %+v %v", f.assignments.Games[20549], err)
	}
	_ = f.cache.Set(f.ctx, "moyu:entries:game:20549", []moyu.Entry{}, moyu.CacheTTL)
	if err := f.service.Assign(f.ctx, admin, 20549, false, []string{"10363"}); err != nil || f.assignments.Games[20549].Assigned || f.cache.Has("moyu:entries:game:20549") {
		t.Fatalf("back to the ids: %+v %v", f.assignments.Games[20549], err)
	}
	if err := f.service.Assign(f.ctx, admin, 404, true, nil); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
}

func TestAPageIsLookedUpByItsAddress(t *testing.T) {
	f := newAssignmentFixture()
	for _, address := range []string{"https://www.moyu.moe/galgame/212857", "212857", "https://www.moyu.moe/resource/11421"} {
		page, err := f.service.Lookup(f.ctx, address)
		if err != nil || page.ID != "212857" || page.Title != "プレミアムアーカイブス むとうけいじ" {
			t.Fatalf("%s: %+v %v", address, page, err)
		}
	}
	for address, want := range map[string]error{
		"https://www.moyu.moe/galgame/2116520": moyu.ErrPageNotFound,
		"https://www.moyu.moe/resource/1":      moyu.ErrPageNotFound,
		"俺たちに翼はない":                             moyu.ErrAddressUnrecognized,
		"https://www.example.com/galgame/3125": moyu.ErrAddressUnrecognized,
	} {
		if _, err := f.service.Lookup(f.ctx, address); !errors.Is(err, want) {
			t.Fatalf("%s: %v", address, err)
		}
	}
	f.patches.Fail = moyu.ErrRequestFailed.Wrap(errors.New("down"))
	if _, err := f.service.Lookup(f.ctx, "212857"); !errors.Is(err, moyu.ErrRequestFailed) {
		t.Fatalf("an outage of the other site: %v", err)
	}
}
