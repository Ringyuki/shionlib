package moyu_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
)

var (
	vndb    = func(id string) moyu.Anchor { return moyu.Anchor{Source: moyu.SourceVNDB, ID: id} }
	bangumi = func(id string) moyu.Anchor { return moyu.Anchor{Source: moyu.SourceBangumi, ID: id} }
)

func anchored(anchors ...moyu.Anchor) moyu.Game {
	return moyu.Game{Anchors: anchors}
}

func ids(entries []moyu.Entry) []string {
	out := []string{}
	for _, entry := range entries {
		out = append(out, entry.ID)
	}
	return out
}

func TestEntries(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{
		Known:  map[moyu.Anchor][]string{vndb("v4145"): {"61311"}},
		Listed: map[string][]moyu.Entry{"v4145": {{ID: "r1", Kind: moyu.KindPatch, Name: "patch"}}, "61311": {{ID: "r1"}, {ID: "r3"}}},
	}
	cache := moyutest.NewCache()
	service := moyu.NewService(moyutest.Games{1: anchored(vndb("v4145"), bangumi("302835")), 2: moyutest.VNDB("v1"), 4: {}}, patches, cache)
	entries, err := service.Entries(ctx, actor.Guest(), 1)
	if err != nil || !slices.Equal(ids(entries), []string{"r1", "r3"}) || entries[0].Kind != moyu.KindPatch {
		t.Fatalf("entries: %+v %v", entries, err)
	}
	if !cache.Has("moyu:entries:game:1") || cache.TTL("moyu:works:vndb:v4145,bangumi:302835") != moyu.WorksTTL {
		t.Fatal("what the other site lists and the work a game is filed under are cached")
	}
	again, err := service.Entries(ctx, actor.Guest(), 1)
	if err != nil || patches.Calls != 1 || len(patches.Lookups) != 2 || len(again) != 2 || again[0].Name != "patch" {
		t.Fatalf("cache hits skip upstream: calls=%d lookups=%v %+v %v", patches.Calls, patches.Lookups, again, err)
	}
	empty, err := service.Entries(ctx, actor.Guest(), 2)
	if err != nil || empty == nil || len(empty) != 0 {
		t.Fatalf("a game the other site does not list has no entries: %v %v", empty, err)
	}
	calls := patches.Calls
	if _, err := service.Entries(ctx, actor.Guest(), 2); err != nil || patches.Calls != calls {
		t.Fatalf("an empty answer is cached too: calls=%d %v", patches.Calls, err)
	}
	for _, gameID := range []int{4, 99} {
		none, err := service.Entries(ctx, actor.Guest(), gameID)
		if err != nil || none == nil || len(none) != 0 || patches.Calls != calls {
			t.Fatalf("game %d without external ids: %v %v", gameID, none, err)
		}
	}
}

func TestAPageIsFoundThroughEveryWorkTheIDsOfItsGameLeadTo(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{
		Known: map[moyu.Anchor][]string{
			vndb("v56650"): {"212857"}, bangumi("700741"): {"255986"}, bangumi("302835"): {"1"}, vndb("v4145"): {"61311"},
		},
		Listed: map[string][]moyu.Entry{"212857": {{ID: "r1"}}, "255986": {{ID: "r2"}}, "1": {{ID: "r3"}}, "61311": {{ID: "r4"}}},
	}
	service := moyu.NewService(moyutest.Games{
		1: moyutest.VNDB("v56650"),
		2: anchored(bangumi("700741")),
		3: anchored(vndb("v9"), bangumi("302835")),
		4: anchored(vndb("v4145"), bangumi("302835")),
	}, patches, moyutest.NewCache())
	for _, c := range []struct {
		game int
		want []string
	}{{1, []string{"r1"}}, {2, []string{"r2"}}, {3, []string{"r3"}}, {4, []string{"r4", "r3"}}} {
		entries, err := service.Entries(ctx, actor.Guest(), c.game)
		if err != nil || !slices.Equal(ids(entries), c.want) {
			t.Fatalf("game %d: %+v %v", c.game, entries, err)
		}
	}
	asked := []moyu.Anchor{vndb("v56650"), bangumi("700741"), vndb("v9"), bangumi("302835"), vndb("v4145"), bangumi("302835")}
	if !slices.Equal(patches.Lookups, asked) {
		t.Fatalf("every id of a game is asked about at once: %v", patches.Lookups)
	}
}

func TestPagesAnAdministratorAssignedTakeThePlaceOfTheIDs(t *testing.T) {
	ctx := context.Background()
	cache := moyutest.NewCache()
	patches := &moyutest.Patches{
		Known:  map[moyu.Anchor][]string{vndb("v2240"): {"10363"}},
		Listed: map[string][]moyu.Entry{"10363": {{ID: "r1"}}, "211652": {{ID: "r2"}}, "212857": {{ID: "r3"}}},
	}
	service := moyu.NewService(moyutest.Games{
		1: {Anchors: []moyu.Anchor{vndb("v2240")}, Assigned: true, Pages: []string{"211652"}},
		2: {Assigned: true, Pages: []string{"212857"}},
		3: {Anchors: []moyu.Anchor{vndb("v2240")}, Assigned: true},
	}, patches, cache)
	for _, c := range []struct {
		game int
		want []string
	}{{1, []string{"r2"}}, {2, []string{"r3"}}, {3, []string{}}} {
		entries, err := service.Entries(ctx, actor.Guest(), c.game)
		if err != nil || !slices.Equal(ids(entries), c.want) {
			t.Fatalf("game %d: %+v %v", c.game, entries, err)
		}
	}
	if len(patches.Lookups) != 0 || patches.Calls != 2 || cache.Has("moyu:entries:game:3") {
		t.Fatalf("assigned pages are asked for by their ids alone, and no pages ask for nothing: lookups %v, calls %d", patches.Lookups, patches.Calls)
	}
	if patches.Unbounded != 0 {
		t.Fatalf("every request of a lookup shares the time one request may take: %d unbounded", patches.Unbounded)
	}
}

func TestAFailureIsReportedOnceAndThenLeavesTheListEmptyForAWhile(t *testing.T) {
	ctx := context.Background()
	for name, patches := range map[string]*moyutest.Patches{
		"patches": {Fail: moyu.ErrRequestFailed.Wrap(errors.New("429"))},
		"works":   {FailWorks: moyu.ErrRequestFailed.Wrap(errors.New("429"))},
	} {
		cache := moyutest.NewCache()
		service := moyu.NewService(moyutest.Games{1: moyutest.VNDB("v9")}, patches, cache)
		if _, err := service.Entries(ctx, actor.Guest(), 1); !errors.Is(err, moyu.ErrRequestFailed) {
			t.Fatalf("%s: expected request failure, got %v", name, err)
		}
		if ttl := cache.TTL("moyu:entries:game:1"); ttl != moyu.FailureTTL || ttl >= moyu.CacheTTL {
			t.Fatalf("%s: a failure holds requests back for a short while: %v", name, ttl)
		}
		if cache.Has("moyu:works:vndb:v9") == (patches.FailWorks != nil) {
			t.Fatalf("%s: only a lookup that was answered is remembered", name)
		}
		calls, lookups := patches.Calls, len(patches.Lookups)
		entries, err := service.Entries(ctx, actor.Guest(), 1)
		if err != nil || entries == nil || len(entries) != 0 || patches.Calls != calls || len(patches.Lookups) != lookups {
			t.Fatalf("%s: while held back the list is empty and upstream is left alone: %v %v", name, entries, err)
		}
	}
}

func TestAnEntryIsFoundByTheDigestOfItsFile(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{Listed: map[string][]moyu.Entry{
		"v4145": {{ID: "r1", Hash: "9f86d081"}, {ID: "r2"}},
	}}
	service := moyu.NewService(moyutest.Games{1: moyutest.VNDB("v4145"), 2: moyutest.VNDB("v1")}, patches, moyutest.NewCache())
	entry, found, err := service.ByHash(ctx, actor.Guest(), 1, " 9F86D081 ")
	if err != nil || !found || entry.ID != "r1" {
		t.Fatalf("found by digest: %+v %v %v", entry, found, err)
	}
	for _, digest := range []string{"", "ffff"} {
		if _, found, err := service.ByHash(ctx, actor.Guest(), 1, digest); err != nil || found {
			t.Fatalf("%q matches nothing, least of all the entries without a digest: %v %v", digest, found, err)
		}
	}
	if _, found, err := service.ByHash(ctx, actor.Guest(), 2, "9f86d081"); err != nil || found {
		t.Fatalf("a game the other site does not list: %v %v", found, err)
	}
	patches.Fail = moyu.ErrRequestFailed.Wrap(errors.New("down"))
	failing := moyu.NewService(moyutest.Games{9: moyutest.VNDB("v9")}, patches, moyutest.NewCache())
	if _, found, err := failing.ByHash(ctx, actor.Guest(), 9, "9f86d081"); err != nil || found {
		t.Fatalf("an outage of the other site matches nothing: %v %v", found, err)
	}
}
