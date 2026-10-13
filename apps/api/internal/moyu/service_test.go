package moyu_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
)

func TestEntries(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{Entries: map[string][]moyu.Entry{
		"v4145": {{ID: "r1", Kind: moyu.KindPatch, Name: "patch"}},
	}}
	cache := moyutest.NewCache()
	service := moyu.NewService(moyutest.Games{1: "v4145", 2: "v1", 4: ""}, patches, cache)

	entries, err := service.Entries(ctx, actor.Guest(), 1)
	if err != nil || len(entries) != 1 || entries[0].ID != "r1" || entries[0].Kind != moyu.KindPatch {
		t.Fatalf("entries: %+v %v", entries, err)
	}
	if !cache.Has("moyu:entries:vndb:v4145") {
		t.Fatal("what the other site lists is cached")
	}
	again, err := service.Entries(ctx, actor.Guest(), 1)
	if err != nil || patches.Calls != 1 || len(again) != 1 || again[0].Name != "patch" {
		t.Fatalf("cache hits skip upstream: calls=%d %+v %v", patches.Calls, again, err)
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
			t.Fatalf("game %d without a vndb id: %v %v", gameID, none, err)
		}
	}
}

func TestAFailureIsReportedOnceAndThenLeavesTheListEmptyForAWhile(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{Fail: moyu.ErrRequestFailed.Wrap(errors.New("429"))}
	cache := moyutest.NewCache()
	service := moyu.NewService(moyutest.Games{1: "v9"}, patches, cache)
	if _, err := service.Entries(ctx, actor.Guest(), 1); !errors.Is(err, moyu.ErrRequestFailed) {
		t.Fatalf("expected request failure, got %v", err)
	}
	if ttl := cache.TTL("moyu:entries:vndb:v9"); ttl != moyu.FailureTTL || ttl >= moyu.CacheTTL {
		t.Fatalf("a failure holds requests back for a short while: %v", ttl)
	}
	entries, err := service.Entries(ctx, actor.Guest(), 1)
	if err != nil || entries == nil || len(entries) != 0 || patches.Calls != 1 {
		t.Fatalf("while held back the list is empty and upstream is left alone: %v %v calls=%d", entries, err, patches.Calls)
	}
}

func TestAnEntryIsFoundByTheDigestOfItsFile(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{Entries: map[string][]moyu.Entry{
		"v4145": {{ID: "r1", Hash: "9f86d081"}, {ID: "r2"}},
	}}
	service := moyu.NewService(moyutest.Games{1: "v4145", 2: "v1"}, patches, moyutest.NewCache())
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
	failing := moyu.NewService(moyutest.Games{9: "v9"}, patches, moyutest.NewCache())
	if _, found, err := failing.ByHash(ctx, actor.Guest(), 9, "9f86d081"); err != nil || found {
		t.Fatalf("an outage of the other site matches nothing: %v %v", found, err)
	}
}
