package bangumiredis_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/bangumiredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestTokenStoreRoundTrip(t *testing.T) {
	client := redistest.New(t)
	ctx := context.Background()
	store := bangumiredis.NewTokenStore(client)
	if _, found, err := store.Load(ctx); err != nil || found {
		t.Fatalf("empty store: %v %v", found, err)
	}
	if err := store.Save(ctx, []byte(`{"access_token":"a"}`)); err != nil {
		t.Fatal(err)
	}
	raw, found, err := store.Load(ctx)
	if err != nil || !found || string(raw) != `{"access_token":"a"}` {
		t.Fatalf("load: %s %v %v", raw, found, err)
	}
	if ttl, _ := client.TTL(ctx, client.Key("bangumi", "tokens")).Result(); ttl >= 0 {
		t.Fatalf("tokens never expire on their own: %v", ttl)
	}
}
