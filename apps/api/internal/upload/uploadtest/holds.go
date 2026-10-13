package uploadtest

import (
	"context"
	"maps"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type holding struct {
	holder string
	until  time.Time
}

type MemoryHolds struct {
	mu    sync.Mutex
	holds map[int]holding
}

func NewMemoryHolds() *MemoryHolds {
	return &MemoryHolds{holds: map[int]holding{}}
}

func (h *MemoryHolds) Hold(_ context.Context, sessionID int, holder string, ttl time.Duration) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	if hold, ok := h.holds[sessionID]; ok && hold.until.After(now) && hold.holder != holder {
		return false, nil
	}
	h.holds[sessionID] = holding{holder: holder, until: now.Add(ttl)}
	return true, nil
}

func (h *MemoryHolds) Holders(_ context.Context, sessionIDs []int) (map[int]string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	holders := map[int]string{}
	for _, id := range sessionIDs {
		if hold, ok := h.holds[id]; ok && hold.until.After(now) {
			holders[id] = hold.holder
		}
	}
	return holders, nil
}

func HoldsContract(t *testing.T, open func(t *testing.T) upload.Holds) {
	ctx := context.Background()
	hold := func(t *testing.T, holds upload.Holds, session int, holder string, ttl time.Duration) bool {
		t.Helper()
		held, err := holds.Hold(ctx, session, holder, ttl)
		if err != nil {
			t.Fatal(err)
		}
		return held
	}

	t.Run("the first holder keeps a session and may renew it", func(t *testing.T) {
		holds := open(t)
		if !hold(t, holds, 1, "phone", time.Minute) {
			t.Fatal("a free session is held by whoever asks first")
		}
		if !hold(t, holds, 1, "phone", time.Minute) {
			t.Fatal("the holder renews its hold")
		}
		if hold(t, holds, 1, "laptop", time.Minute) {
			t.Fatal("another holder got a session that is held")
		}
		if !hold(t, holds, 2, "laptop", time.Minute) {
			t.Fatal("sessions are held one by one")
		}
		holders, err := holds.Holders(ctx, []int{1, 2, 3})
		if err != nil || !maps.Equal(holders, map[int]string{1: "phone", 2: "laptop"}) {
			t.Fatalf("holders: %v %v", holders, err)
		}
		none, err := holds.Holders(ctx, nil)
		if err != nil || len(none) != 0 {
			t.Fatalf("holders of nothing: %v %v", none, err)
		}
	})

	t.Run("a hold that is not renewed runs out", func(t *testing.T) {
		holds := open(t)
		if !hold(t, holds, 1, "phone", 40*time.Millisecond) {
			t.Fatal("not held")
		}
		time.Sleep(80 * time.Millisecond)
		holders, err := holds.Holders(ctx, []int{1})
		if err != nil || len(holders) != 0 {
			t.Fatalf("an expired hold is still listed: %v %v", holders, err)
		}
		if !hold(t, holds, 1, "laptop", time.Minute) {
			t.Fatal("an expired hold still keeps others out")
		}
	})
}
