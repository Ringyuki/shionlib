package uploadredis_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/uploadredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

func TestHoldsContract(t *testing.T) {
	uploadtest.HoldsContract(t, func(t *testing.T) upload.Holds {
		return uploadredis.NewHolds(redistest.New(t))
	})
}

func TestHoldsLiveUnderTheUploadNamespaceWithTheirTTL(t *testing.T) {
	client := redistest.New(t)
	holds := uploadredis.NewHolds(client)
	if held, err := holds.Hold(t.Context(), 7, "phone", time.Minute); err != nil || !held {
		t.Fatalf("hold: %v %v", held, err)
	}
	ttl, err := client.PTTL(t.Context(), client.Key("upload", "hold", "7")).Result()
	if err != nil || ttl <= 0 || ttl > time.Minute {
		t.Fatalf("ttl: %v %v", ttl, err)
	}
}
