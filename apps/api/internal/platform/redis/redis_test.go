package redis_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func open(t *testing.T, prefix string) *redis.Client {
	t.Helper()
	opts := redistest.Options(t)
	opts.KeyPrefix = prefix
	client, err := redis.Open(t.Context(), opts)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Shutdown(t.Context()) })
	return client
}

func TestKeysAreNamespacedByThePrefix(t *testing.T) {
	if key := open(t, "shionlib").Key("auth", "verification"); key != "shionlib:auth:verification" {
		t.Fatalf("prefixed key %q", key)
	}
	if key := open(t, "").Key("auth", "verification"); key != "auth:verification" {
		t.Fatalf("unprefixed key %q", key)
	}
}

func TestOpenFailsFastWhenRedisIsUnreachable(t *testing.T) {
	start := time.Now()
	if _, err := redis.Open(t.Context(), redis.Options{Host: "127.0.0.1", Port: 1, Timeout: 200 * time.Millisecond}); err == nil {
		t.Fatal("expected a connection error")
	}
	if time.Since(start) > 6*time.Second {
		t.Fatal("open must not hang")
	}
}
