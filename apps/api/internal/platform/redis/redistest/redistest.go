package redistest

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

func Options(t *testing.T) redis.Options {
	t.Helper()
	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		if os.Getenv("REQUIRE_INTEGRATION") != "" {
			t.Fatal("TEST_REDIS_ADDR is required when REQUIRE_INTEGRATION is set")
		}
		t.Skip("TEST_REDIS_ADDR is not set; skipping Redis integration test")
	}
	host, rawPort, err := net.SplitHostPort(addr)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(rawPort)
	if err != nil {
		t.Fatal(err)
	}
	return redis.Options{Host: host, Port: port, Timeout: 3 * time.Second}
}

func New(t *testing.T) *redis.Client {
	t.Helper()
	opts := Options(t)
	var suffix [6]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		t.Fatal(err)
	}
	prefix := "test:" + hex.EncodeToString(suffix[:])
	opts.KeyPrefix = prefix
	client, err := redis.Open(context.Background(), opts)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		keys, _ := client.Keys(ctx, prefix+":*").Result()
		if len(keys) > 0 {
			_ = client.Del(ctx, keys...).Err()
		}
		_ = client.Close()
	})
	return client
}
