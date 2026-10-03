package moyu_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
)

func TestResources(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{Lookups: map[string]moyu.Lookup{
		"v4145": {Found: true, Resources: []moyu.Resource{json.RawMessage(`{"id":"r1"}`)}},
		"v1":    {Found: true},
	}}
	cache := moyutest.NewCache()
	service := moyu.NewService(moyutest.Games{1: "v4145", 2: "v1", 3: "v404", 4: ""}, patches, cache)

	resources, err := service.Resources(ctx, actor.Guest(), 1)
	if err != nil || len(resources) != 1 || string(resources[0]) != `{"id":"r1"}` {
		t.Fatalf("resources: %s %v", resources, err)
	}
	if !cache.Has("moyu:patch:resources:vndb:v4145") {
		t.Fatal("positive lookups are cached")
	}
	if _, err := service.Resources(ctx, actor.Guest(), 1); err != nil || patches.Calls != 1 {
		t.Fatalf("cache hits skip upstream: calls=%d %v", patches.Calls, err)
	}
	empty, err := service.Resources(ctx, actor.Guest(), 2)
	if err != nil || empty == nil || len(empty) != 0 {
		t.Fatalf("a patch page without resources is an empty list: %v %v", empty, err)
	}
	if _, err := service.Resources(ctx, actor.Guest(), 3); !errors.Is(err, moyu.ErrPatchNotFound) {
		t.Fatalf("no patch page: %v", err)
	}
	if !cache.Has("moyu:patch:resources:vndb:v404") {
		t.Fatal("misses are cached too")
	}
	calls := patches.Calls
	if _, err := service.Resources(ctx, actor.Guest(), 3); !errors.Is(err, moyu.ErrPatchNotFound) || patches.Calls != calls {
		t.Fatalf("cached misses skip upstream: %v", err)
	}
	for _, gameID := range []int{4, 99} {
		if _, err := service.Resources(ctx, actor.Guest(), gameID); !errors.Is(err, moyu.ErrPatchNotFound) || patches.Calls != calls {
			t.Fatalf("game %d without vndb id: %v", gameID, err)
		}
	}
}

func TestUpstreamFailuresAreNotCached(t *testing.T) {
	ctx := context.Background()
	patches := &moyutest.Patches{Fail: moyu.ErrRequestFailed.Wrap(errors.New("429"))}
	cache := moyutest.NewCache()
	service := moyu.NewService(moyutest.Games{1: "v9"}, patches, cache)
	if _, err := service.Resources(ctx, actor.Guest(), 1); !errors.Is(err, moyu.ErrRequestFailed) {
		t.Fatalf("expected request failure, got %v", err)
	}
	if cache.Has("moyu:patch:resources:vndb:v9") {
		t.Fatal("failures must not be cached")
	}
}
