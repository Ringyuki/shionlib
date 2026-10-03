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

func New(t *testing.T) *redis.Client {
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
	var suffix [6]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		t.Fatal(err)
	}
	prefix := "test:" + hex.EncodeToString(suffix[:])
	client, err := redis.Open(context.Background(), redis.Options{Host: host, Port: port, KeyPrefix: prefix, Timeout: 3 * time.Second})
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
