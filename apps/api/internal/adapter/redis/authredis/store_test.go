package authredis_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/authredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestStoreTakeIsSingleUse(t *testing.T) {
	ctx := context.Background()
	client := redistest.New(t)
	store := authredis.NewStore(client)
	if err := store.Put(ctx, "verification:id:a@example.test", []byte(`{"code":"ABC123"}`), time.Minute); err != nil {
		t.Fatal(err)
	}
	if exists, err := client.Exists(ctx, client.Key("auth", "verification:id:a@example.test")).Result(); err != nil || exists != 1 {
		t.Fatalf("keys live under the auth namespace: %d %v", exists, err)
	}
	value, found, err := store.Get(ctx, "verification:id:a@example.test")
	if err != nil || !found || string(value) != `{"code":"ABC123"}` {
		t.Fatalf("get: %s %v %v", value, found, err)
	}
	var taken atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			if _, found, err := store.Take(ctx, "verification:id:a@example.test"); err == nil && found {
				taken.Add(1)
			}
		})
	}
	wg.Wait()
	if taken.Load() != 1 {
		t.Fatalf("exactly one caller may take the value, got %d", taken.Load())
	}
	if _, found, err := store.Get(ctx, "missing"); err != nil || found {
		t.Fatalf("missing key: %v %v", found, err)
	}
}

func TestStoreExpires(t *testing.T) {
	ctx := context.Background()
	client := redistest.New(t)
	store := authredis.NewStore(client)
	if err := store.Put(ctx, "short", []byte("x"), 50*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	ttl, err := client.PTTL(ctx, client.Key("auth", "short")).Result()
	if err != nil || ttl <= 0 || ttl > 50*time.Millisecond {
		t.Fatalf("ttl: %v %v", ttl, err)
	}
}
