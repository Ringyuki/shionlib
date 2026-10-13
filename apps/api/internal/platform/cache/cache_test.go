package cache_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/cache"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestJSONRoundTripAndPrefixDeletion(t *testing.T) {
	c := cache.New(redistest.New(t))
	ctx := context.Background()
	type value struct {
		Name string `json:"name"`
		N    int    `json:"n"`
	}
	if err := c.Set(ctx, "game:1:detail", value{Name: "a", N: 1}, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := c.Set(ctx, "game:1:header", value{Name: "b"}, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := c.Set(ctx, "game:10:detail", value{Name: "c"}, time.Minute); err != nil {
		t.Fatal(err)
	}
	var got value
	if found, err := c.Get(ctx, "game:1:detail", &got); err != nil || !found || got.Name != "a" || got.N != 1 {
		t.Fatalf("round trip: %+v %v %v", got, found, err)
	}
	if err := c.DeletePrefix(ctx, "game:1:"); err != nil {
		t.Fatal(err)
	}
	if found, _ := c.Get(ctx, "game:1:header", &got); found {
		t.Fatal("prefix deletion left a key behind")
	}
	if found, _ := c.Get(ctx, "game:10:detail", &got); !found {
		t.Fatal("prefix deletion must not match game:10")
	}
	if found, err := c.Get(ctx, "missing", &got); err != nil || found {
		t.Fatalf("missing key: %v %v", found, err)
	}
}
