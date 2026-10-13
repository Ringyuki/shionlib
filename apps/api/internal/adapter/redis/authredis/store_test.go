package authredis_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/authredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestStoreContract(t *testing.T) {
	authtest.StoreContract(t, func(t *testing.T) authtest.Store {
		return authredis.NewStore(redistest.New(t))
	})
}

func TestStoreKeepsStateUnderTheAuthNamespaceWithItsTTL(t *testing.T) {
	client := redistest.New(t)
	store := authredis.NewStore(client)
	code := auth.VerificationCode{Email: "a@example.test", Code: "ABC123", Created: time.Now()}
	if err := store.SaveVerificationCode(t.Context(), "id", code, 50*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	ttl, err := client.PTTL(t.Context(), client.Key("auth", "verification:id:a@example.test")).Result()
	if err != nil || ttl <= 0 || ttl > 50*time.Millisecond {
		t.Fatalf("ttl: %v %v", ttl, err)
	}
}
