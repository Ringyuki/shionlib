package bangumiredis_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/bangumiredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestAStateIsTakenOnceAndExpires(t *testing.T) {
	client := redistest.New(t)
	ctx := context.Background()
	store := bangumiredis.NewStateStore(client)
	if _, known, err := store.Take(ctx, "unknown"); err != nil || known {
		t.Fatalf("an unknown state: %v %v", known, err)
	}
	if err := store.Save(ctx, "state-1", "/zh/admin/catalog", 10*time.Minute); err != nil {
		t.Fatal(err)
	}
	if ttl, _ := client.TTL(ctx, client.Key("bangumi", "oauth", "state-1")).Result(); ttl <= 0 || ttl > 10*time.Minute {
		t.Fatalf("a state expires: %v", ttl)
	}
	returnTo, known, err := store.Take(ctx, "state-1")
	if err != nil || !known || returnTo != "/zh/admin/catalog" {
		t.Fatalf("take: %q %v %v", returnTo, known, err)
	}
	if _, known, _ := store.Take(ctx, "state-1"); known {
		t.Fatal("a state is taken once")
	}
}
